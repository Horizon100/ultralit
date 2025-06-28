// src/routes/api/posts/[id]/repost/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		console.log('🔥 REPOST ENDPOINT HIT!', {
			postId: params.id,
			userId: locals.user?.id,
			userExists: !!locals.user
		});

		if (!locals.user) {
			console.log('❌ No user authenticated');
			throw new Error('Unauthorized');
		}

		const postId = params.id;
		const userId = locals.user.id;

		console.log(`🎯 Toggling repost for post ${postId} by user ${userId}`);

		try {
			const post = await pb.collection('posts').getOne(postId);
			console.log('📄 Found post:', {
				id: post.id,
				repostedBy: post.repostedBy,
				repostCount: post.repostCount
			});

			const repostedBy = post.repostedBy || [];
			const hasReposted = repostedBy.includes(userId);

			console.log('🔍 Current repost status:', {
				hasReposted,
				repostedByArray: repostedBy,
				currentCount: post.repostCount
			});

			let updatedRepostedBy;
			let repostCount;

			if (hasReposted) {
				console.log('➖ Removing repost');
				updatedRepostedBy = repostedBy.filter((id: string) => id !== userId);
				repostCount = Math.max(0, (post.repostCount || 0) - 1);
			} else {
				console.log('➕ Adding repost');
				updatedRepostedBy = [...repostedBy, userId];
				repostCount = (post.repostCount || 0) + 1;
			}

			console.log('🔄 Updating with:', {
				updatedRepostedBy,
				repostCount,
				willBeReposted: !hasReposted
			});

			const updatedPost = await pb.collection('posts').update(postId, {
				repostedBy: updatedRepostedBy,
				repostCount: repostCount
			});

			console.log('✅ Update successful:', {
				newRepostedBy: updatedPost.repostedBy,
				newRepostCount: updatedPost.repostCount
			});

			const response = {
				success: true,
				reposted: !hasReposted,
				repostCount,
				repostedBy: updatedRepostedBy
			};

			console.log('🚀 Returning response:', response);
			return response;
		} catch (error) {
			console.error('❌ Error in repost operation:', error);
			throw error;
		}
	}, 'Failed to toggle repost');

export const PATCH: RequestHandler = POST;
