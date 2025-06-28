import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { DMMessage } from '$lib/types/types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const receiverId = url.searchParams.get('receiverId');
		const page = parseInt(url.searchParams.get('page') || '1');
		const perPage = parseInt(url.searchParams.get('perPage') || '50');

		if (!receiverId) {
			return json({ error: 'receiverId is required' }, { status: 400 });
		}

		// Get messages between current user and specified user
		const messages = await pb.collection('dm_messages').getList<DMMessage>(page, perPage, {
			filter: `(senderId = "${locals.user.id}" && receiverId = "${receiverId}") || (senderId = "${receiverId}" && receiverId = "${locals.user.id}")`,
			sort: '-created',
			expand: 'senderId,receiverId'
		});

		return json({
			messages: messages.items.reverse(), // Reverse to show oldest first
			totalPages: messages.totalPages,
			page: messages.page,
			perPage: messages.perPage,
			totalItems: messages.totalItems
		});
	} catch (error) {
		console.error('Error fetching DM messages:', error);
		return json({ error: 'Failed to fetch messages' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { content, receiverId, replyId } = await request.json();

		if (!content || !receiverId) {
			return json({ error: 'content and receiverId are required' }, { status: 400 });
		}

		if (content.trim().length === 0) {
			return json({ error: 'Message content cannot be empty' }, { status: 400 });
		}

		if (content.length > 1000) {
			return json({ error: 'Message content too long (max 1000 characters)' }, { status: 400 });
		}

		// Create new message
		const messageData = {
			content: content.trim(),
			senderId: locals.user.id,
			receiverId,
			...(replyId && { replyId })
		};

		const message = await pb.collection('dm_messages').create<DMMessage>(messageData, {
			expand: 'senderId,receiverId'
		});

		return json({ message }, { status: 201 });
	} catch (error) {
		console.error('Error creating DM message:', error);
		return json({ error: 'Failed to create message' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const messageId = url.searchParams.get('messageId');

		if (!messageId) {
			return json({ error: 'messageId is required' }, { status: 400 });
		}

		// Get message to verify ownership
		const message = await pb.collection('dm_messages').getOne<DMMessage>(messageId);

		if (message.senderId !== locals.user.id) {
			return json({ error: 'You can only delete your own messages' }, { status: 403 });
		}

		await pb.collection('dm_messages').delete(messageId);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting DM message:', error);
		return json({ error: 'Failed to delete message' }, { status: 500 });
	}
};
