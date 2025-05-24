// src/routes/api/posts/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const query = url.searchParams.get('q') || '';
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		if (!query) {
			return json({ posts: [], total: 0 });
		}

		/*
		 * Build filter conditions
		 * This will search in the post content
		 */
		const filter = `content ~ "${query}"`;

		// Fetch posts with the search filter
		const postsData = await pb.collection('posts').getList(1, limit, {
			filter,
			sort: '-created',
			expand: 'user', // Expand the user reference to get author details
			skip: offset
		});

		// Get the current user's ID if authenticated
		const currentUserId = locals.user?.id;

		// Process posts to include interaction information
		const posts = postsData.items.map((post) => {
			// Convert PocketBase record to a plain object
			const plainPost = { ...post };

			// Add user interaction flags if the user is authenticated
			if (currentUserId) {
				plainPost.upvote = post.upvotedBy?.includes(currentUserId) || false;
				plainPost.downvote = post.downvotedBy?.includes(currentUserId) || false;
				plainPost.repost = post.repostedBy?.includes(currentUserId) || false;
				plainPost.hasRead = post.readBy?.includes(currentUserId) || false;
				plainPost.share = post.sharedBy?.includes(currentUserId) || false;
				plainPost.quote = post.quotedBy?.includes(currentUserId) || false;
			} else {
				// Default values for non-authenticated users
				plainPost.upvote = false;
				plainPost.downvote = false;
				plainPost.repost = false;
				plainPost.hasRead = false;
				plainPost.share = false;
				plainPost.quote = false;
			}

			// Add author information
			if (post.expand?.user) {
				plainPost.author_name = post.expand.user.name;
				plainPost.author_username = post.expand.user.username;
				plainPost.author_avatar = post.expand.user.avatar;
			}

			return plainPost;
		});

		return json({
			posts,
			total: postsData.totalItems,
			totalPages: postsData.totalPages,
			page: postsData.page
		});
	} catch (error) {
		console.error('Error searching posts:', error);
		return json({ error: 'Failed to search posts' }, { status: 500 });
	}
};
