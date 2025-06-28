import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { Post } from '$lib/types/types.posts';

export const PATCH: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		console.log(`Marking post ${postId} as read by user ${userId}`);

		const post = (await pb.collection('posts').getOne(postId)) as Post;

		if (post.user === userId) {
			console.log(`User ${userId} is the author of post ${postId}, not counting read`);
			return json({
				success: true,
				hasRead: false,
				readCount: post.readCount || 0
			});
		}

		const readBy = post.readBy || [];
		let hasRead = false;

		if (!readBy.includes(userId)) {
			readBy.push(userId);
			hasRead = true;

			const readCountExcludingAuthor = readBy.filter((id) => id !== post.user).length;

			const updatedPost = (await pb.collection('posts').update(postId, {
				readBy,
				readCount: readCountExcludingAuthor
			})) as Post;

			console.log(
				`Post ${postId} marked as read successfully. Read count: ${readCountExcludingAuthor}`
			);

			return json({
				success: true,
				hasRead,
				readCount: updatedPost.readCount
			});
		} else {
			console.log(`Post ${postId} already read by user ${userId}`);
			return json({
				success: true,
				hasRead: true,
				readCount: post.readCount || 0
			});
		}
	}, 'mark post as read');
