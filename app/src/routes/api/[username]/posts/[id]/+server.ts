import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { pbTryCatch, apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const { username, id } = params;

		if (!id) {
			throw new Error('Post ID is required');
		}

		// Find user by username
		const userResult = await pbTryCatch(
			pb.collection('users').getList(1, 1, {
				filter: `username = "${username}"`
			}),
			'fetch user by username'
		);

		if (!userResult.success || userResult.data.items.length === 0) {
			throw new Error('User not found');
		}

		const user = userResult.data.items[0];

		// Get the post
		const postResult = await pbTryCatch(
			pb.collection('posts').getOne(id, {
				expand: 'user'
			}),
			'fetch post'
		);

		if (!postResult.success) {
			throw new Error('Post not found');
		}

		const post = postResult.data;

		// Check if this post belongs to the user or if the user has reposted it
		const isOwnPost = post.user === user.id;
		const isReposted = post.repostedBy?.includes(user.id);

		if (!isOwnPost && !isReposted) {
			throw new Error('Post not found');
		}

		// Get comments for the post
		const commentsResult = await pbTryCatch(
			pb.collection('posts').getList(1, 100, {
				filter: `parent = "${id}"`,
				sort: 'created',
				expand: 'user'
			}),
			'fetch comments'
		);

		const comments = commentsResult.success ? commentsResult.data.items : [];

		return {
			post,
			comments,
			user
		};
	}, 'Failed to fetch post');