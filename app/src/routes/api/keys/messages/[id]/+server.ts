// src/routes/api/keys/messages/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		const messageId = params.id;
		const currentUserId = locals.user?.id;

		if (!currentUserId) {
			throw error(401, 'Authentication required');
		}

		const messageResult = await pbTryCatch(
			pb.collection('messages').getOne(messageId),
			'fetch message'
		);
		const message = unwrap(messageResult);

		if (message.thread) {
			try {
				const threadResult = await pbTryCatch(
					pb.collection('threads').getOne(message.thread),
					'fetch thread'
				);
				const thread = unwrap(threadResult);

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
							(Array.isArray(project.collaborators) &&
								project.collaborators.includes(currentUserId));
					} catch (err) {
						console.warn('Project access check failed:', err);
					}
				}

				if (!isCreator && !isOp && !isMember && !hasProjectAccess) {
					throw error(403, 'You do not have permission to access this message');
				}
			} catch (err) {
				if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
					if (message.user !== currentUserId) {
						throw error(403, 'You do not have permission to access this message');
					}
				} else {
					throw err;
				}
			}
		} else if (message.user !== currentUserId) {
			throw error(403, 'You do not have permission to access this message');
		}

		return json({ success: true, message });
	}, 'Failed to fetch message');

export const PATCH: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(async () => {
		const messageId = params.id;
		const currentUserId = locals.user?.id;

		if (!currentUserId) {
			throw error(401, 'Authentication required');
		}

		const messageResult = await pbTryCatch(
			pb.collection('messages').getOne(messageId),
			'fetch message'
		);
		const existingMessage = unwrap(messageResult);

		if (existingMessage.user !== currentUserId) {
			let isThreadOwner = false;

			if (existingMessage.thread) {
				try {
					const threadResult = await pbTryCatch(
						pb.collection('threads').getOne(existingMessage.thread),
						'fetch thread'
					);
					const thread = unwrap(threadResult);
					isThreadOwner = thread.user === currentUserId;
				} catch (err) {
					console.warn('Thread owner check failed:', err);
				}
			}

			if (!isThreadOwner) {
				throw error(403, 'You do not have permission to update this message');
			}
		}

		const data = await request.json();
		const updateResult = await pbTryCatch(
			pb.collection('messages').update(messageId, data),
			'update message'
		);
		const updatedMessage = unwrap(updateResult);

		return json({ success: true, message: updatedMessage });
	}, 'Failed to update message');

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		const messageId = params.id;
		const currentUserId = locals.user?.id;

		if (!currentUserId) {
			throw error(401, 'Authentication required');
		}

		const messageResult = await pbTryCatch(
			pb.collection('messages').getOne(messageId),
			'fetch message'
		);
		const existingMessage = unwrap(messageResult);

		if (existingMessage.user !== currentUserId) {
			let isThreadOwner = false;

			if (existingMessage.thread) {
				try {
					const threadResult = await pbTryCatch(
						pb.collection('threads').getOne(existingMessage.thread),
						'fetch thread'
					);
					const thread = unwrap(threadResult);
					isThreadOwner = thread.user === currentUserId;
				} catch (err) {
					console.warn('Thread owner check failed:', err);
				}
			}

			if (!isThreadOwner) {
				throw error(403, 'You do not have permission to delete this message');
			}
		}

		await pbTryCatch(pb.collection('messages').delete(messageId), 'delete message');

		return json({ success: true });
	}, 'Failed to delete message');
