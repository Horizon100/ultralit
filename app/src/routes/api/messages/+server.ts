// src/routes/api/messages/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import type { Messages } from '$lib/types/types';

export const GET: RequestHandler = async ({ url, locals, cookies }) =>
	apiTryCatch(async () => {
		console.log('🔍 Messages GET endpoint called');

		// Check authentication - prefer locals.user, fallback to cookies
		let currentUserId: string;
		
		if (locals.user) {
			currentUserId = locals.user.id;
		} else {
			const authCookie = cookies.get('pb_auth');
			if (!authCookie) {
				throw new Error('Not authenticated');
			}
			pb.authStore.loadFromCookie(authCookie);
			if (!pb.authStore.isValid) {
				throw new Error('Invalid authentication');
			}
			currentUserId = pb.authStore.model?.id;
		}

		if (!currentUserId) {
			throw new Error('User ID not found');
		}

		// Check if this is a search request
		const query = url.searchParams.get('q');
		if (query) {
			// Handle search functionality
			const limit = url.searchParams.get('limit') || '10'; 
			const projectId = url.searchParams.get('project');

			console.log('Search params:', { query, limit, projectId, currentUserId });

			if (query.trim().length === 0) {
				return {
					success: true,
					messages: []
				};
			}

			let filter = `text ~ "${query}" && user = "${currentUserId}"`;

			if (projectId) {
				filter += ` && thread.project_id = "${projectId}"`;
			}

			console.log('Search filter:', filter);

			const messages = await pb.collection('messages').getList(1, parseInt(limit), {
				filter,
				sort: '-created',
				expand: 'thread,user',
				fields: '*,expand.thread.name,expand.thread.project_id,expand.user.name'
			});

			console.log('Search successful, found:', messages.items.length, 'messages');

			const messagesWithContext = (messages.items as Messages[]).map((message) => ({
				...message,
				threadName: message.expand?.thread?.name || 'Unknown Thread',
				threadId: message.thread,
				userName: message.expand?.user?.name || 'Unknown User',
				projectId: message.expand?.thread?.project_id || null
			}));

			return {
				success: true,
				messages: messagesWithContext,
				total: messages.totalItems
			};
		}

		// Handle regular message fetching (by thread or user)
		const threadId = url.searchParams.get('thread');

		if (threadId) {
			// Fetch messages for a specific thread
			const threadResult = await pbTryCatch(
				pb.collection('threads').getOne(threadId),
				'fetch thread'
			);
			const thread = unwrap(threadResult);

			// Check thread permissions
			const isCreator = thread.user === currentUserId;
			const isOp = thread.op === currentUserId;

			let isMember = false;
			if (thread.members) {
				if (typeof thread.members === 'string') {
					isMember = thread.members.includes(currentUserId);
				} else if (Array.isArray(thread.members)) {
					isMember = thread.members.some((m) =>
						typeof m === 'string' ? m === currentUserId : m.id === currentUserId
					);
				}
			}

			let hasProjectAccess = false;
			if (thread.project) {
				const projectId = typeof thread.project === 'string' ? thread.project : thread.project.id;
				try {
					const projectResult = await pbTryCatch(
						pb.collection('projects').getOne(projectId),
						'fetch project'
					);
					const project = unwrap(projectResult);
					hasProjectAccess =
						project.owner === currentUserId ||
						(Array.isArray(project.collaborators) && project.collaborators.includes(currentUserId));
				} catch (err) {
					console.warn('Project access check failed:', err);
				}
			}

			if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
				throw error(403, 'You do not have permission to access this thread');
			}

			const messagesResult = await pbTryCatch(
				pb.collection('messages').getFullList<Messages>({
					filter: `thread = "${threadId}"`,
					sort: '+created'
				}),
				'fetch thread messages'
			);
			const messages = unwrap(messagesResult);

			return {
				success: true,
				messages
			};
		} else {
			// Fetch all messages for the user
			const messagesResult = await pbTryCatch(
				pb.collection('messages').getFullList<Messages>({
					filter: `user = "${currentUserId}"`,
					sort: '-created'
				}),
				'fetch user messages'
			);
			const messages = unwrap(messagesResult);

			return {
				success: true,
				messages
			};
		}
	}, 'Failed to fetch messages');

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		console.log('Messages POST: Creating message - START');

		if (!locals.user) {
			console.error('Messages POST: User not authenticated');
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const currentUserId = locals.user.id;
		let data;

		try {
			data = await request.json();
			console.log('Messages POST: Received data:', JSON.stringify(data, null, 2));
		} catch (parseError) {
			console.error('Messages POST: Failed to parse JSON:', parseError);
			return json({ success: false, error: 'Invalid JSON data' }, { status: 400 });
		}

		if (!data.text && !data.attachments) {
			console.log('Messages POST: Empty message allowed, proceeding...');
		}

		if (data.thread) {
			try {
				console.log('Messages POST: Checking thread permissions for:', data.thread);
				const thread = await pb.collection('threads').getOne(data.thread);
				console.log('Messages POST: Thread found:', thread.id);

				const isCreator = thread.user === currentUserId;
				const isOp = thread.op === currentUserId;

				let isMember = false;
				if (thread.members) {
					if (typeof thread.members === 'string') {
						isMember = thread.members.includes(currentUserId);
					} else if (Array.isArray(thread.members)) {
						isMember = thread.members.some((m) =>
							typeof m === 'string' ? m === currentUserId : m.id === currentUserId
						);
					}
				}

				console.log(
					'Messages POST: Thread permissions - Creator:',
					isCreator,
					'Op:',
					isOp,
					'Member:',
					isMember
				);

				if (!isCreator && !isOp && !isMember) {
					console.error('Messages POST: No permission to post to thread');
					return json(
						{ success: false, error: 'No permission to post to this thread' },
						{ status: 403 }
					);
				}
			} catch (threadError) {
				console.error('Messages POST: Thread check failed:', threadError);
				return json({ success: false, error: 'Thread not found or inaccessible' }, { status: 404 });
			}
		}

const messageData = {
			text: data.text || '',
			user: data.user || currentUserId,
			thread: data.thread || null,
			parent_msg: data.parent_msg || null,
			type: data.type || 'text',
			prompt_type: data.prompt_type || null,
			prompt_input: data.prompt_input || null,
			model: data.model || '',
			read_by: Array.isArray(data.read_by) ? data.read_by : [currentUserId],
			attachments: data.attachments || '',
			task_relation: data.task_relation || null,
			agent_relation: data.agent_relation || null
		};

		console.log(
			'Messages POST: Creating message with data:',
			JSON.stringify(messageData, null, 2)
		);

		try {
			const message = await pb.collection('messages').create(messageData);
			console.log('Messages POST: Message created successfully:', message.id);

			if (data.thread) {
				try {
					await pb.collection('threads').update(data.thread, {
						updated: new Date().toISOString()
					});
					console.log('Messages POST: Thread timestamp updated');
				} catch (threadUpdateError) {
					console.warn('Messages POST: Failed to update thread timestamp:', threadUpdateError);
				}
			}

			console.log('Messages POST: Returning success response with message:', message.id);
			return json({
				success: true,
				message: message
			});
		} catch (createError) {
			console.error('Messages POST: Failed to create message:', createError);

			if (createError && typeof createError === 'object' && 'status' in createError) {
				const error = createError as { status?: number; message?: string };
				const errorMsg = error.message || 'Database error occurred';
				return json({ success: false, error: errorMsg }, { status: error.status || 500 });
			}

			return json({ success: false, error: 'Failed to create message' }, { status: 500 });
		}
	} catch (outerError) {
		console.error('Messages POST: Unexpected error:', outerError);
		return json(
			{
				success: false,
				error: outerError instanceof Error ? outerError.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};