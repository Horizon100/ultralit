// src/routes/api/messages/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, cookies }) => {
	console.log('🔍 Message search endpoint called');

	try {
		// Ensure user is authenticated (matching your /api/messages pattern)
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			return json(
				{
					success: false,
					error: 'Not authenticated'
				},
				{ status: 401 }
			);
		}

		pb.authStore.loadFromCookie(authCookie);

		if (!pb.authStore.isValid) {
			return json(
				{
					success: false,
					error: 'Invalid authentication'
				},
				{ status: 401 }
			);
		}

		const query = url.searchParams.get('q');
		const limit = url.searchParams.get('limit') || '10';
		const projectId = url.searchParams.get('project');
		const userId = pb.authStore.model?.id;

		console.log('Search params:', { query, limit, projectId, userId });

		if (!query || query.trim().length === 0) {
			return json({
				success: true,
				messages: []
			});
		}

		// Build filter to only get user's accessible messages
		let filter = `text ~ "${query}"`;

		// Add user filter to only get messages user has created
		filter += ` && user = "${userId}"`;

		if (projectId) {
			filter += ` && thread.project_id = "${projectId}"`;
		}

		console.log('Search filter:', filter);

		// Search messages
		const messages = await pb.collection('messages').getList(1, parseInt(limit), {
			filter,
			sort: '-created',
			expand: 'thread,user',
			fields: '*,expand.thread.name,expand.thread.project_id,expand.user.name'
		});

		console.log('Search successful, found:', messages.items.length, 'messages');

		// Transform the results
		const messagesWithContext = messages.items.map((message: any) => ({
			...message,
			threadName: message.expand?.thread?.name || 'Unknown Thread',
			threadId: message.thread,
			userName: message.expand?.user?.name || 'Unknown User',
			projectId: message.expand?.thread?.project_id || null
		}));

		return json({
			success: true,
			messages: messagesWithContext,
			total: messages.totalItems
		});
	} catch (error) {
		console.error('❌ Error in message search:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to search messages'
			},
			{ status: 500 }
		);
	}
};
