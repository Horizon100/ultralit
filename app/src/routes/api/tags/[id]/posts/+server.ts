// src/routes/api/tags/[id]/posts/+server.ts
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Tag } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, validationTryCatch } from '$lib/utils/errorUtils';

// Add a post to a tag's taggedPosts array
export const POST: RequestHandler = async ({ params, request, locals }) => {
	return apiTryCatch(async () => {
		if (!locals.user) {
			const error = new Error('Unauthorized');
			error.message = 'unauthorized';
			throw error;
		}

		const tagId = params.id;
		if (!tagId) {
			throw new Error('Tag ID is required');
		}

		// Parse request data first
		const requestData = await request.json();

		// Then validate it
		const requestDataResult = validationTryCatch(() => {
			if (!requestData.postId) {
				throw new Error('Post ID is required');
			}
			return requestData;
		}, 'request data');

		if (!requestDataResult.success) {
			throw new Error(requestDataResult.error);
		}

		const { postId } = requestDataResult.data;

		console.log('Adding post to tag:', { tagId, postId });

		// Get the current tag
		const tagResult = await pbTryCatch(pb.collection('tags').getOne(tagId), 'fetch tag');

		if (!tagResult.success) {
			throw new Error(tagResult.error);
		}

		const tag = tagResult.data as Tag;

		// Verify user has permission to modify this tag
		if (tag.createdBy !== locals.user.id) {
			const error = new Error('Unauthorized to modify this tag');
			error.message = 'forbidden';
			throw error;
		}

		// Get current taggedPosts array
		const taggedPosts = tag.taggedPosts || [];

		// Add postId if not already present
		if (!taggedPosts.includes(postId)) {
			taggedPosts.push(postId);

			// Update the tag
			const updateResult = await pbTryCatch(
				pb.collection('tags').update(tagId, {
					taggedPosts
				}),
				'update tag with new post'
			);

			if (!updateResult.success) {
				throw new Error(updateResult.error);
			}

			const updatedTag = updateResult.data as Tag;

			console.log('Successfully added post to tag:', { tagId, postId });
			return updatedTag;
		} else {
			console.log('Post already tagged:', { tagId, postId });
			return tag;
		}
	}, 'Failed to add post to tag');
};

// Get all posts for a specific tag
export const GET: RequestHandler = async ({ params, url, locals }) => {
	return apiTryCatch(async () => {
		const tagId = params.id;
		if (!tagId) {
			throw new Error('Tag ID is required');
		}

		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const page = Math.floor(offset / limit) + 1;

		console.log('Getting posts for tag:', { tagId, limit, offset, page });

		// Get the tag to access taggedPosts
		const tagResult = await pbTryCatch(pb.collection('tags').getOne(tagId), 'fetch tag for posts');

		if (!tagResult.success) {
			throw new Error(tagResult.error);
		}

		const tag = tagResult.data as Tag;
		const taggedPosts = tag.taggedPosts || [];

		if (taggedPosts.length === 0) {
			return {
				success: true,
				posts: [],
				totalItems: 0,
				totalPages: 0
			};
		}

		// Create filter for posts
		const postFilter = taggedPosts.map((postId) => `id = "${postId}"`).join(' || ');

		// Fetch the posts
		const postsResult = await pbTryCatch(
			pb.collection('posts').getList(page, limit, {
				filter: postFilter,
				sort: '-created'
			}),
			'fetch posts for tag'
		);

		if (!postsResult.success) {
			throw new Error(postsResult.error);
		}

		console.log(`Found ${postsResult.data.items.length} posts for tag ${tagId}`);

		return {
			success: true,
			posts: postsResult.data.items,
			totalItems: postsResult.data.totalItems,
			totalPages: postsResult.data.totalPages
		};
	}, 'Failed to get posts for tag');
};
