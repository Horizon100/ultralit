import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { pbTryCatch, apiTryCatch } from '$lib/utils/errorUtils';
import type { ProfilePost } from '$lib/types/types.posts';


export const GET: RequestHandler = async ({ params, url, locals }) => {
	return apiTryCatch(async () => {
		const { username } = params;

		// Get pagination parameters
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const page = Math.floor(offset / limit) + 1;

		console.log('🔍 API username:', username, 'offset:', offset, 'limit:', limit);

		const isAuthenticated = !!locals.user;
		const currentUserId = locals.user?.id;

		const userResult = await pbTryCatch(
			pb.collection('users').getList(1, 1, {
				filter: `username = "${username}"`,
				// ADD status and last_login here:
				fields:
					'id,username,name,email,avatar,description,profileWallpaper,wallpaper_preference,created,updated,status,last_login,followers,followin,location,website,model_preference,taskAssignments,userTaskStatus,hero'
			}),
			'fetch user by username'
		);

		if (!userResult.success || userResult.data.items.length === 0) {
			throw new Error('User not found');
		}

		const user = userResult.data.items[0];
		console.log('✅ Found user:', user.id, user.username);

		// Fetch posts with proper interaction data
		console.log('📊 Fetching ALL posts for user...');

		const [originalPostsResult, repostedPostsResult] = await Promise.all([
			pbTryCatch(
				pb.collection('posts').getList(1, 200, {
					filter: `user = "${user.id}"`,
					sort: '-created',
					expand: 'user'
				}),
				'fetch original posts'
			),
			pbTryCatch(
				pb.collection('posts').getList(1, 200, {
					filter: `repostedBy ~ "${user.id}"`,
					sort: '-created',
					expand: 'user'
				}),
				'fetch reposted posts'
			)
		]);

		if (!originalPostsResult.success || !repostedPostsResult.success) {
			throw new Error('Failed to fetch posts');
		}

		const originalPosts = originalPostsResult.data;
		const repostedPosts = repostedPostsResult.data;

		console.log('📊 Raw posts fetched:', {
			original: originalPosts.items.length,
			reposts: repostedPosts.items.length
		});

		// Create combined array with proper interaction data
		const allPosts: ProfilePost[] = [];

		// Add original posts with proper interaction calculations
		originalPosts.items.forEach((post) => {
			const upvotedBy = post.upvotedBy || [];
			const downvotedBy = post.downvotedBy || [];
			const repostedBy = post.repostedBy || [];
			const readBy = post.readBy || [];
			const sharedBy = post.sharedBy || [];
			const quotedBy = post.quotedBy || [];
			const commentedBy = post.commentedBy || [];

			// Calculate user interaction state
			const upvote = isAuthenticated && currentUserId ? upvotedBy.includes(currentUserId) : false;
			const downvote =
				isAuthenticated && currentUserId ? downvotedBy.includes(currentUserId) : false;
			const repost = isAuthenticated && currentUserId ? repostedBy.includes(currentUserId) : false;
			const hasRead = isAuthenticated && currentUserId ? readBy.includes(currentUserId) : false;
			const share = isAuthenticated && currentUserId ? sharedBy.includes(currentUserId) : false;
			const quote = isAuthenticated && currentUserId ? quotedBy.includes(currentUserId) : false;

			// Calculate read count (excluding the author)
			const readCount = readBy.filter((id: string) => id !== post.user).length;

			allPosts.push({
				...post,
				isRepost: false,

				// User interaction state
				upvote,
				downvote,
				repost,
				hasRead,
				share,
				quote,
				preview: false,

				// Interaction counts - use database values or calculate from arrays
				upvoteCount: post.upvoteCount ?? upvotedBy.length,
				downvoteCount: post.downvoteCount ?? downvotedBy.length,
				repostCount: post.repostCount ?? repostedBy.length,
				readCount: post.readCount ?? readCount,
				shareCount: post.shareCount ?? sharedBy.length,
				quoteCount: post.quoteCount ?? quotedBy.length,
				commentCount: post.commentCount ?? commentedBy.length,

				// Arrays for tracking interactions
				upvotedBy,
				downvotedBy,
				repostedBy,
				readBy,
				sharedBy,
				quotedBy,
				commentedBy,

				// Tags
				tags: post.tags || [],
				tagCount: post.tagCount ?? (post.tags || []).length,

				// Required fields with proper defaults
				content: post.content || '',
				user: post.user || '',
				parent: post.parent || '',
				children: post.children || [],
				quotedPost: post.quotedPost || ''
			});
		});

		// Add reposts from others
		repostedPosts.items.forEach((post) => {
			if (post.user !== user.id) {
				const upvotedBy = post.upvotedBy || [];
				const downvotedBy = post.downvotedBy || [];
				const repostedBy = post.repostedBy || [];
				const readBy = post.readBy || [];
				const sharedBy = post.sharedBy || [];
				const quotedBy = post.quotedBy || [];
				const commentedBy = post.commentedBy || [];

				// Calculate user interaction state for reposts
				const upvote = isAuthenticated && currentUserId ? upvotedBy.includes(currentUserId) : false;
				const downvote =
					isAuthenticated && currentUserId ? downvotedBy.includes(currentUserId) : false;
				const repostState =
					isAuthenticated && currentUserId ? repostedBy.includes(currentUserId) : false;
				const hasRead = isAuthenticated && currentUserId ? readBy.includes(currentUserId) : false;
				const share = isAuthenticated && currentUserId ? sharedBy.includes(currentUserId) : false;
				const quote = isAuthenticated && currentUserId ? quotedBy.includes(currentUserId) : false;

				const readCount = readBy.filter((id: string) => id !== post.user).length;

				allPosts.push({
					...post,
					id: `repost_${post.id}_${user.id}`,
					isRepost: true,
					originalPostId: post.id,
					repostedBy_id: user.id,
					repostedBy_username: user.username,
					repostedBy_name: user.name,
					repostedBy_avatar: user.avatar,

					// User interaction state
					upvote,
					downvote,
					repost: repostState,
					hasRead,
					share,
					quote,
					preview: false,

					// Interaction counts - use database values or calculate
					upvoteCount: post.upvoteCount ?? upvotedBy.length,
					downvoteCount: post.downvoteCount ?? downvotedBy.length,
					repostCount: post.repostCount ?? repostedBy.length,
					readCount: post.readCount ?? readCount,
					shareCount: post.shareCount ?? sharedBy.length,
					quoteCount: post.quoteCount ?? quotedBy.length,
					commentCount: post.commentCount ?? commentedBy.length,

					// Arrays
					upvotedBy,
					downvotedBy,
					repostedBy,
					readBy,
					sharedBy,
					quotedBy,
					commentedBy,

					// Tags
					tags: post.tags || [],
					tagCount: post.tagCount ?? (post.tags || []).length,

					// Required fields
					content: post.content || '',
					user: post.user || '',
					parent: post.parent || '',
					children: post.children || [],
					quotedPost: post.quotedPost || ''
				});
			}
		});

		// Enhance posts with user data
		allPosts.forEach((post) => {
			if (post.expand?.user) {
				post.author_name = post.expand.user.name;
				post.author_username = post.expand.user.username;
				post.author_avatar = post.expand.user.avatar;
			}
		});

		// Sort by created date
		allPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		console.log('📊 All posts combined and sorted:', allPosts.length);

		// Apply pagination
		const startIndex = offset;
		const endIndex = offset + limit;
		const paginatedPosts = allPosts.slice(startIndex, endIndex);

		// Calculate hasMore correctly
		const totalPosts = allPosts.length;
		const postsReturned = paginatedPosts.length;
		const postsAlreadyFetched = offset + postsReturned;
		const hasMore = postsAlreadyFetched < totalPosts;

		console.log('🔥 PAGINATION CALCULATION:', {
			totalPosts,
			offset,
			limit,
			startIndex,
			endIndex,
			postsReturned,
			postsAlreadyFetched,
			hasMore,
			formula: `${postsAlreadyFetched} < ${totalPosts} = ${hasMore}`
		});

		// Get profile (only on first page)
		let profile = null;
		if (offset === 0) {
			const profileResult = await pbTryCatch(
				pb.collection('users').getList(1, 1, {
					filter: `user = "${user.id}"`
				}),
				'fetch user profile'
			);
			if (profileResult.success) {
				profile = profileResult.data.items[0] || null;
			}
		}

		console.log(
			`✅ API: Returning ${postsReturned} posts out of ${totalPosts} total, hasMore: ${hasMore}`
		);

		return {
			user: {
				id: user.id,
				username: user.username,
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				description: user.description,
				profileWallpaper: user.profileWallpaper || '',
				wallpaper_preference: user.wallpaper_preference || '',
				status: user.status || 'offline',
				followers: user.followers || [],
				following: user.following || [],
				follower_count: (user.followers || []).length,
				following_count: (user.following || []).length,
				last_login: user.last_login,
				location: user.location || '',
				website: user.website || '',
				created: user.created,
				updated: user.updated
			},
			profile: offset === 0 ? profile : undefined,
			posts: paginatedPosts,
			totalPosts: totalPosts,
			currentPage: page,
			hasMore: hasMore
		};
	}, 'Failed to fetch user profile');
};
