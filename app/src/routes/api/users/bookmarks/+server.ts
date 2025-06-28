import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request }) =>
	apiTryCatch(async () => {
		const { userId, bookmarks } = await request.json();

		await pb.collection('users').update(userId, { bookmarks });

		return { success: true };
	}, 'Failed to update bookmarks');
