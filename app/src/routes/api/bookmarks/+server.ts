// src/routes/api/bookmarks/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals }) => {
	return apiTryCatch(async () => {
		const user = locals.user;
		if (!user?.bookmarks?.length) {
			return [];
		}

		const records = await pb.collection('messages').getList(1, 50, {
			filter: user.bookmarks.map((id) => `id = '${id}'`).join(' || '),
			sort: '-created',
			expand: 'user,thread'
		});

		return records.items.map((message) => ({
			id: message.id,
			text: message.text,
			type: message.type,
			created: message.created,
			thread: message.thread,
			threadName: message.expand?.thread?.name || 'Unknown Thread',
			attachments: message.attachments
		}));
	}, 'fetch bookmarks');
};

export const POST: RequestHandler = async ({ request, locals }) => {
	return apiTryCatch(async () => {
		const user = locals.user;

		if (!user) {
			throw new Error('Authentication required');
		}

		const { messageId, action } = await request.json();

		if (!messageId || !['add', 'remove'].includes(action)) {
			throw new Error('Invalid request parameters');
		}

		const currentBookmarks = user.bookmarks || [];
		let updatedBookmarks: string[];

		if (action === 'add') {
			if (!currentBookmarks.includes(messageId)) {
				updatedBookmarks = [...currentBookmarks, messageId];
			} else {
				updatedBookmarks = currentBookmarks;
			}
		} else {
			updatedBookmarks = currentBookmarks.filter((id) => id !== messageId);
		}

		await pb.collection('users').update(user.id, {
			bookmarks: updatedBookmarks
		});

		return {
			success: true,
			bookmarks: updatedBookmarks,
			message: action === 'add' ? 'Added to bookmarks' : 'Removed from bookmarks'
		};
	}, 'update bookmarks');
};
