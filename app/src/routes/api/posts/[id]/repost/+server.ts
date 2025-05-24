import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		// Get the current post
		const post = await pb.collection('posts').getOne(postId);

		const repostedBy = post.repostedBy || [];
		const hasReposted = repostedBy.includes(userId);

		let updatedRepostedBy;
		let repostCount;

		if (hasReposted) {
			// Remove repost
			updatedRepostedBy = repostedBy.filter((id: string) => id !== userId);
			repostCount = Math.max(0, (post.repostCount || 0) - 1);
		} else {
			// Add repost
			updatedRepostedBy = [...repostedBy, userId];
			repostCount = (post.repostCount || 0) + 1;
		}

		// Update the post
		await pb.collection('posts').update(postId, {
			repostedBy: updatedRepostedBy,
			repostCount: repostCount
		});

		return json({
			success: true,
			reposted: !hasReposted,
			repostCount: repostCount,
			repostedBy: updatedRepostedBy
		});
	} catch (error) {
		console.error('Error toggling repost:', error);
		return json({ error: 'Failed to toggle repost' }, { status: 500 });
	}
};
export const PATCH: RequestHandler = async ({ params, locals }) => {
	// Same logic as POST
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = params.id;
		const userId = locals.user.id;

		// Get the current post
		const post = await pb.collection('posts').getOne(postId);

		const repostedBy = post.repostedBy || [];
		const hasReposted = repostedBy.includes(userId);

		let updatedRepostedBy;
		let repostCount;

		if (hasReposted) {
			// Remove repost
			updatedRepostedBy = repostedBy.filter((id: string) => id !== userId);
			repostCount = Math.max(0, (post.repostCount || 0) - 1);
		} else {
			// Add repost
			updatedRepostedBy = [...repostedBy, userId];
			repostCount = (post.repostCount || 0) + 1;
		}

		// Update the post
		await pb.collection('posts').update(postId, {
			repostedBy: updatedRepostedBy,
			repostCount: repostCount
		});

		return json({
			success: true,
			reposted: !hasReposted,
			repostCount: repostCount,
			repostedBy: updatedRepostedBy
		});
	} catch (error) {
		console.error('Error toggling repost:', error);
		return json({ error: 'Failed to toggle repost' }, { status: 500 });
	}
};
