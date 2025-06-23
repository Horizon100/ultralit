import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		const post = await pb.collection('posts').getOne(postId);
		const sharedBy = post.sharedBy || [];
		const hasShared = sharedBy.includes(userId);

		if (!hasShared) {
			const updatedSharedBy = [...sharedBy, userId];
			const shareCount = (post.shareCount || 0) + 1;

			const updatedPost = await pb.collection('posts').update(postId, {
				sharedBy: updatedSharedBy,
				shareCount
			});

			return {
				success: true,
				shareCount,
				sharedBy: updatedSharedBy,
				alreadyShared: false
			};
		} else {
			return {
				success: true,
				shareCount: post.shareCount || 0,
				sharedBy,
				alreadyShared: true
			};
		}
	}, 'Share post failed');
