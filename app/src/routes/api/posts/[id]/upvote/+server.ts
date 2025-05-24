import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const PATCH: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const postId = params.id;
		const userId = locals.user.id;

		console.log(`Toggling upvote for post ${postId} by user ${userId}`);

		try {
			// Get current post
			const post = await pb.collection('posts').getOne(postId);

			let upvotedBy = post.upvotedBy || [];
			let downvotedBy = post.downvotedBy || [];
			let upvoted = false;

			// Toggle upvote
			if (upvotedBy.includes(userId)) {
				// Remove upvote
				upvotedBy = upvotedBy.filter((id: string) => id !== userId);
			} else {
				// Add upvote and remove downvote if exists
				upvotedBy.push(userId);
				upvoted = true;
				downvotedBy = downvotedBy.filter((id: string) => id !== userId);
			}

			// Update post with new arrays and counts
			const updatedPost = await pb.collection('posts').update(postId, {
				upvotedBy,
				downvotedBy,
				upvoteCount: upvotedBy.length,
				downvoteCount: downvotedBy.length
			});

			console.log(`Upvote toggle successful for post ${postId}`);

			return json({
				success: true,
				upvoted,
				upvoteCount: updatedPost.upvoteCount,
				downvoteCount: updatedPost.downvoteCount
			});
		} catch (err) {
			console.error(`Error toggling upvote for post ${postId}:`, err);

			if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
				return new Response(JSON.stringify({ error: 'Post not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw err;
		}
	} catch (error) {
		console.error('Error in upvote handler:', error);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
