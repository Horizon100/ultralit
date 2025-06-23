// src/routes/api/messages/search/+server.ts
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { Messages } from '$lib/types/types';

export const GET: RequestHandler = async ({ url, cookies }) =>
	apiTryCatch(async () => {
		console.log('🔍 Message search endpoint called');

		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			throw new Error('Not authenticated');
		}

		pb.authStore.loadFromCookie(authCookie);

		if (!pb.authStore.isValid) {
			throw new Error('Invalid authentication');
		}

		const query = url.searchParams.get('q');
		const limit = url.searchParams.get('limit') || '10';
		const projectId = url.searchParams.get('project');
		const userId = pb.authStore.model?.id;

		console.log('Search params:', { query, limit, projectId, userId });

		if (!query || query.trim().length === 0) {
			return {
				success: true,
				messages: []
			};
		}

		let filter = `text ~ "${query}" && user = "${userId}"`;

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
	}, 'Failed to search messages');
