import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		console.log(`Toggling downvote for post ${postId} by user ${userId}`);

		const post = await pb.collection('posts').getOne(postId);

		let upvotedBy = post.upvotedBy || [];
		let downvotedBy = post.downvotedBy || [];
		let downvoted = false;

		// Toggle downvote
		if (downvotedBy.includes(userId)) {
			downvotedBy = downvotedBy.filter((id: string) => id !== userId);
		} else {
			downvotedBy.push(userId);
			downvoted = true;
			upvotedBy = upvotedBy.filter((id: string) => id !== userId);
		}

		const updatedPost = await pb.collection('posts').update(postId, {
			upvotedBy,
			downvotedBy,
			upvoteCount: upvotedBy.length,
			downvoteCount: downvotedBy.length
		});

		console.log(`Downvote toggle successful for post ${postId}`);

		return {
			success: true,
			downvoted,
			upvoteCount: updatedPost.upvoteCount,
			downvoteCount: updatedPost.downvoteCount
		};
	}, 'toggle post downvote');
