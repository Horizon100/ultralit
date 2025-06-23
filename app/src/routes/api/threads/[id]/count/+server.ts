import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	return apiTryCatch(async () => {
		const { params, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const threadId = params.id;
		if (!threadId) {
			throw new Error('Thread ID is required');
		}

		const pocketBase = locals?.pb || pb;
		const result = await pocketBase.collection('messages').getList(1, 1, {
			filter: `thread = "${threadId}"`,
			$autoCancel: false
		});

		return {
			count: result.totalItems,
			success: true
		};
	}, 'Error fetching thread count');
};