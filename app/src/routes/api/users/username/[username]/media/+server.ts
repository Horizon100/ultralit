// src/routes/api/users/username/[username]/media/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, url }) => {
	const { username } = params;
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	try {
		console.log(`🖼️ Fetching ALL media for: ${username}, offset: ${offset}, limit: ${limit}`);

		// Get user
		const user = await pb.collection('users').getFirstListItem(`username = "${username}"`);

		// Get ALL user's posts (not just 20)
		let allUserPosts: any[] = [];
		let page = 1;
		let hasMorePosts = true;

		while (hasMorePosts) {
			const posts = await pb.collection('posts').getList(page, 100, {
				filter: `user = "${user.id}"`,
				fields: 'id',
				sort: '-created'
			});

			allUserPosts = [...allUserPosts, ...posts.items];
			hasMorePosts = page < posts.totalPages;
			page++;

			// Add small delay to avoid rate limits
			if (hasMorePosts) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		console.log(`📊 Found ${allUserPosts.length} total posts for ${username}`);

		if (allUserPosts.length === 0) {
			return json({
				success: true,
				data: { items: [], hasMore: false, totalItems: 0 }
			});
		}

		// Process posts in chunks to avoid query size limits
		const chunkSize = 20;
		let allMediaItems: any[] = [];

		for (let i = 0; i < allUserPosts.length; i += chunkSize) {
			const chunk = allUserPosts.slice(i, i + chunkSize);
			const postIds = chunk.map((p) => p.id);
			const filter = postIds.map((id) => `post = "${id}"`).join(' || ');

			try {
				const media = await pb.collection('posts_attachments').getList(1, 200, {
					filter: `(${filter}) && (file_type = "image" || file_type = "video")`,
					sort: '-created'
				});

				allMediaItems = [...allMediaItems, ...media.items];

				// Small delay between chunks
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (chunkError) {
				console.error('Error fetching media chunk:', chunkError);
				// Continue with other chunks
			}
		}

		// Sort all media by creation date
		allMediaItems.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		console.log(`📊 Found ${allMediaItems.length} total media items`);

		// Apply pagination
		const paginatedItems = allMediaItems.slice(offset, offset + limit);
		const hasMore = offset + limit < allMediaItems.length;

		console.log(`🖼️ Returning ${paginatedItems.length} items, hasMore: ${hasMore}`);

		return json({
			success: true,
			data: {
				items: paginatedItems,
				hasMore,
				totalItems: allMediaItems.length
			}
		});
	} catch (error) {
		console.error('Media API error:', error);
		return json(
			{
				success: false,
				data: { items: [], hasMore: false, totalItems: 0 }
			},
			{ status: 500 }
		);
	}
};
