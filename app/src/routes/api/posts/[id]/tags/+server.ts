// src/routes/api/posts/[id]/tags/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	console.log('🏷️ === TAGS ENDPOINT CALLED ===');
	console.log('🏷️ Post ID:', params.id);
	console.log('🏷️ User ID:', locals.user?.id);

	return apiTryCatch(async () => {
		if (!locals.user) {
			console.log('❌ No user authenticated');
			throw new Error('Unauthorized');
		}

		const postId = params.id;
		const userId = locals.user.id;

		// Parse request body
		const requestData = await request.json();
		console.log('🏷️ === REQUEST DATA ===');
		console.log('🏷️ Full request:', JSON.stringify(requestData, null, 2));
		console.log('🏷️ Tags field:', requestData.tags);
		console.log('🏷️ Tags type:', typeof requestData.tags);
		console.log('🏷️ Is Array:', Array.isArray(requestData.tags));
		console.log('🏷️ Tags length:', requestData.tags?.length);

		if (!requestData.tags || !Array.isArray(requestData.tags)) {
			throw new Error('Tags must be an array');
		}

		// Get current post
		console.log('🏷️ === BEFORE UPDATE ===');
		const post = await pb.collection('posts').getOne(postId);
		console.log('📄 Current post:', {
			id: post.id,
			user: post.user,
			tags: post.tags,
			tagCount: post.tagCount,
			tagsType: typeof post.tags,
			tagsIsArray: Array.isArray(post.tags)
		});

		// Verify user ownership
		if (post.user !== userId) {
			throw new Error('Unauthorized to modify this post');
		}

		// Prepare update data
		const updateData = {
			tags: requestData.tags,
			tagCount: requestData.tags.length
		};
		console.log('🏷️ === UPDATE DATA ===');
		console.log('🏷️ Update object:', JSON.stringify(updateData, null, 2));

		// Update post with new tags
		console.log('🏷️ === PERFORMING UPDATE ===');
		const updatedPost = await pb.collection('posts').update(postId, updateData);
		
		console.log('🏷️ === AFTER UPDATE ===');
		console.log('✅ Updated post result:', {
			id: updatedPost.id,
			tags: updatedPost.tags,
			tagCount: updatedPost.tagCount,
			tagsType: typeof updatedPost.tags,
			tagsIsArray: Array.isArray(updatedPost.tags),
			tagsStringified: JSON.stringify(updatedPost.tags)
		});

		// Verify by fetching fresh from database
		console.log('🏷️ === VERIFICATION FETCH ===');
		const verifyPost = await pb.collection('posts').getOne(postId);
		console.log('🔍 Fresh fetch result:', {
			id: verifyPost.id,
			tags: verifyPost.tags,
			tagCount: verifyPost.tagCount,
			tagsType: typeof verifyPost.tags,
			tagsIsArray: Array.isArray(verifyPost.tags),
			tagsStringified: JSON.stringify(verifyPost.tags)
		});

		console.log('🏷️ === ENDPOINT COMPLETE ===');

		return {
			success: true,
			data: updatedPost
		};
	}, 'Failed to update post tags');
};

// Add a GET handler to test if the route is working
export const GET: RequestHandler = async ({ params }) => {
	console.log('🔍 GET request to tags endpoint for post:', params.id);
	return json({
		message: 'Tags endpoint is working',
		postId: params.id,
		method: 'GET'
	});
};