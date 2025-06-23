import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals, url }) => {
	console.log('Thread GET endpoint called');

	if (!locals.user) {
		console.log('No authenticated user found');
		return json({ success: false, message: 'Authentication required' }, { status: 401 });
	}

	const userId = locals.user.id;
	console.log('Authenticated user:', userId);

	try {
		const pb = locals.pb;
		if (!pb) {
			console.log('PocketBase instance not found in locals');
			return json(
				{ success: false, message: 'Database connection not available' },
				{ status: 500 }
			);
		}

		// Parse query parameters
		const projectId = url.searchParams.get('project');
		const unassignedOnly = url.searchParams.get('unassigned') === 'true';

		console.log('Project ID from query:', projectId);
		console.log('Unassigned only:', unassignedOnly);

		// Build base filter for user access
		let filter = `op = "${userId}" || members ?~ "${userId}"`;

		// Apply project filtering logic
		if (projectId) {
			// Load threads for specific project
			filter = `(${filter}) && project_id = "${projectId}"`;
		} else if (unassignedOnly) {
			// Explicitly load only unassigned threads
			filter = `(${filter}) && (project_id = "" || project_id = null)`;
		}
		// If neither projectId nor unassignedOnly, load ALL threads for user

		console.log('Using filter:', filter);

		try {
			const threads = await pb.collection('threads').getList(1, 50, {
				filter,
				sort: '-updated',
				expand: 'op,project' // Expand related records for more complete data
			});

			console.log(`Found ${threads.items.length} threads`);

			// Add additional metadata for debugging
			const result = {
				success: true,
				threads: threads.items,
				data: threads.items, // For backward compatibility
				meta: {
					total: threads.totalItems,
					page: threads.page,
					perPage: threads.perPage,
					totalPages: threads.totalPages,
					projectId: projectId,
					unassignedOnly: unassignedOnly
				}
			};

			return json(result);
		} catch (filterError) {
			console.error('Error with filter:', filterError);

			// If the complex filter fails, try a simpler one
			try {
				const simpleFilter = `op = "${userId}"`;
				console.log('Trying simple filter:', simpleFilter);

				const simpleThreads = await pb.collection('threads').getList(1, 50, {
					filter: simpleFilter,
					sort: '-updated'
				});

				console.log(`Found ${simpleThreads.items.length} threads with simple filter`);

				return json({
					success: true,
					threads: simpleThreads.items,
					data: simpleThreads.items,
					meta: {
						fallbackUsed: true,
						total: simpleThreads.totalItems
					}
				});
			} catch (simpleError) {
				console.error('Error with simple filter:', simpleError);

				// If even the simple filter fails, return an empty array
				return json({
					success: true,
					threads: [],
					data: [],
					meta: {
						error: 'Filter failed, returned empty result',
						fallbackUsed: true
					}
				});
			}
		}
	} catch (err) {
		console.error('Unexpected thread fetch error:', err);
		return json(
			{
				success: false,
				message: 'Failed to fetch threads',
				error: err instanceof Error ? err.message : String(err)
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('API threads: Creating new thread');

	if (!locals.user) {
		console.error('API threads: User not authenticated');
		throw error(401, 'Unauthorized');
	}

	try {
		const data = await request.json();
		const userId = locals.user.id;

		// Prepare thread data with required fields
		const threadData: Record<string, unknown> = {
			name: data.name || 'New Thread',
			user: userId,
			op: data.op || userId,
			members: data.members || [userId],
			description: data.description || '',
			updated: new Date().toISOString(),
			created: new Date().toISOString()
		};

		// Handle project assignment more explicitly
		if (data.project && data.project.trim() !== '') {
			threadData.project = data.project.trim();
			threadData.project_id = data.project_id || data.project.trim();
		} else if (data.project_id && data.project_id.trim() !== '') {
			threadData.project_id = data.project_id.trim();
			threadData.project = data.project || data.project_id.trim();
		}
		// If neither project nor project_id is provided, thread remains unassigned

		// Include any other fields that were sent
		for (const [key, value] of Object.entries(data)) {
			if (
				value !== undefined &&
				![
					'name',
					'user',
					'op',
					'members',
					'description',
					'project',
					'project_id',
					'updated',
					'created'
				].includes(key)
			) {
				threadData[key] = value;
			}
		}

		console.log('API threads: Creating thread with data:', threadData);

		// Create the thread
		const thread = await pb.collection('threads').create(threadData);

		console.log(`API threads: Thread created with ID: ${thread.id}`);

		return json({
			success: true,
			data: thread,
			thread: thread
		});
	} catch (err) {
		console.error('API threads: Error creating thread:', err);
		return json(
			{
				success: false,
				message: err instanceof Error ? err.message : 'Failed to create thread',
				error: err
			},
			{ status: 400 }
		);
	}
};
