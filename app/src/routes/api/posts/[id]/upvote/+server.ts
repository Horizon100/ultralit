// src/routes/api/posts/[id]/upvote/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	console.log('🔥 UPVOTE ENDPOINT HIT!', {
		postId: params.id,
		method: request.method,
		url: request.url,
		userId: locals.user?.id
	});

	return apiTryCatch(async () => {
		if (!locals.user) {
			console.log('❌ No user authenticated');
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		console.log(`🎯 Toggling upvote for post ${postId} by user ${userId}`);

		// Get current post
		const post = await pb.collection('posts').getOne(postId);
		console.log('📄 Found post:', {
			id: post.id,
			upvotedBy: post.upvotedBy,
			upvoteCount: post.upvoteCount
		});

		let upvotedBy = post.upvotedBy || [];
		let downvotedBy = post.downvotedBy || [];
		let upvoted = false;

		// Toggle upvote
		if (upvotedBy.includes(userId)) {
			// Remove upvote
			upvotedBy = upvotedBy.filter((id: string) => id !== userId);
			console.log('➖ Removing upvote');
		} else {
			// Add upvote and remove downvote if exists
			upvotedBy.push(userId);
			upvoted = true;
			downvotedBy = downvotedBy.filter((id: string) => id !== userId);
			console.log('➕ Adding upvote');
		}

		// Update post with new arrays and counts
		const updatedPost = await pb.collection('posts').update(postId, {
			upvotedBy,
			downvotedBy,
			upvoteCount: upvotedBy.length,
			downvoteCount: downvotedBy.length
		});

		console.log(`✅ Upvote toggle successful for post ${postId}`, {
			upvoted,
			upvoteCount: updatedPost.upvoteCount,
			downvoteCount: updatedPost.downvoteCount
		});

		const result = {
			success: true,
			upvoted,
			upvoteCount: updatedPost.upvoteCount,
			downvoteCount: updatedPost.downvoteCount
		};

		console.log('🚀 Returning result:', result);
		return result;
	}, 'Failed to toggle upvote');
};

// Add a GET handler to test if the route is working
export const GET: RequestHandler = async ({ params }) => {
	console.log('🔍 GET request to upvote endpoint for post:', params.id);
	return json({
		message: 'Upvote endpoint is working',
		postId: params.id,
		method: 'GET'
	});
};
