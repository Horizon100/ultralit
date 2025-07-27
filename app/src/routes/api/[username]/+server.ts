import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { pbTryCatch, apiTryCatch } from '$lib/utils/errorUtils';
import type { PostWithInteractionsExtended } from '$lib/types/types.posts';

// Extended type to include the additional fields your logic adds
interface ProfilePost extends PostWithInteractionsExtended {
	isRepost: boolean;
	isOwnRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}

export const GET: RequestHandler = async ({ params, url }) => {
	return apiTryCatch(async () => {
		const { username } = params;

		// Get pagination parameters (same as the other endpoint)
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const page = Math.floor(offset / limit) + 1;

		console.log(
			'API/[username]: Looking for username:',
			username,
			'offset:',
			offset,
			'limit:',
			limit,
			'page:',
			page
		);

		// Find user by username
		const userResult = await pbTryCatch(
			pb.collection('users').getList(1, 1, {
				filter: `username = "${username}"`,
				fields:
					'id,username,name,email,avatar,description,profileWallpaper,wallpaper_preference,status,last_login,followers,following,created,updated'
			}),
			'fetch user by username'
		);

		if (!userResult.success) {
			throw new Error(userResult.error);
		}

		if (userResult.data.items.length === 0) {
			const error = new Error('User not found');
			error.message = 'not found';
			throw error;
		}

		const user = userResult.data.items[0];
		console.log('=== USER PROFILE DEBUG ===');
		console.log('User ID:', user.id);
		console.log('Username:', user.username);

		// Get user's original posts and reposts separately WITH PAGINATION
		const [originalPostsResult, repostedPostsResult] = await Promise.all([
			// Original posts by the user - WITH PAGINATION
			pbTryCatch(
				pb.collection('posts').getList(page, limit, {
					filter: `user = "${user.id}"`,
					sort: '-created',
					expand: 'user'
				}),
				'fetch original posts'
			),

			// Posts reposted by the user - WITH PAGINATION
			pbTryCatch(
				pb.collection('posts').getList(page, limit, {
					filter: `repostedBy ~ "${user.id}"`,
					sort: '-created',
					expand: 'user'
				}),
				'fetch reposted posts'
			)
		]);

		if (!originalPostsResult.success) {
			throw new Error(originalPostsResult.error);
		}

		if (!repostedPostsResult.success) {
			throw new Error(repostedPostsResult.error);
		}

		const originalPosts = originalPostsResult.data;
		const repostedPosts = repostedPostsResult.data;

		console.log('Original posts for this page:', originalPosts.items.length);
		console.log('Reposted posts for this page:', repostedPosts.items.length);

		// Create a combined array with proper flags
		const allPosts: ProfilePost[] = [];

		// Add original posts (but check if they were also reposted by the user)
		originalPosts.items.forEach((post) => {
			const isOwnRepost = post.repostedBy && post.repostedBy.includes(user.id);
			allPosts.push({
				...post,
				isRepost: false,
				isOwnRepost: isOwnRepost,
				// For original posts, set reposter info if they reposted their own post
				...(isOwnRepost && {
					repostedBy_id: user.id,
					repostedBy_username: user.username,
					repostedBy_name: user.name,
					repostedBy_avatar: user.avatar
				})
			});

			// If user reposted their own post, add a separate repost entry
			if (isOwnRepost) {
				allPosts.push({
					...post,
					id: `repost_${post.id}_${user.id}`, // Create unique ID for repost
					isRepost: true,
					originalPostId: post.id,
					repostedBy_id: user.id,
					repostedBy_username: user.username,
					repostedBy_name: user.name,
					repostedBy_avatar: user.avatar,
					// Add missing PostWithInteractionsExtended properties with defaults
					upvote: false,
					downvote: false,
					repost: true, // This is a repost
					preview: false,
					hasRead: false,
					share: false,
					quote: false,
					tagCount: 0,
					tags: [],
					content: '',
					user: '',
					upvotedBy: [],
					downvotedBy: [],
					repostedBy: [],
					commentedBy: [],
					sharedBy: [],
					quotedBy: [],
					readBy: [],
					upvoteCount: 0,
					downvoteCount: 0,
					repostCount: 0,
					commentCount: 0,
					shareCount: 0,
					quoteCount: 0,
					readCount: 0,
					parent: '',
					children: [],
					quotedPost: ''
				});
			}
		});

		repostedPosts.items.forEach((post) => {
			// Only add if it's not the user's own post (already handled above)
			if (post.user !== user.id) {
				allPosts.push({
					...post,
					id: `repost_${post.id}_${user.id}`, // Create unique ID for repost
					isRepost: true,
					originalPostId: post.id,
					repostedBy_id: user.id,
					repostedBy_username: user.username,
					repostedBy_name: user.name,
					repostedBy_avatar: user.avatar,
					// Add missing PostWithInteractionsExtended properties with defaults
					upvote: false,
					downvote: false,
					repost: true, // This is a repost
					preview: false,
					hasRead: false,
					share: false,
					quote: false,
					tagCount: 0,
					tags: [],
					content: '',
					user: '',
					upvotedBy: [],
					downvotedBy: [],
					repostedBy: [],
					commentedBy: [],
					sharedBy: [],
					quotedBy: [],
					readBy: [],
					upvoteCount: 0,
					downvoteCount: 0,
					repostCount: 0,
					commentCount: 0,
					shareCount: 0,
					quoteCount: 0,
					readCount: 0,
					parent: '',
					children: [],
					quotedPost: ''
				});
			}
		});

// Collect all unique user IDs from posts
		const userIds = new Set<string>();
		allPosts.forEach(post => {
			if (post.user) userIds.add(post.user);
		});

		// Fetch user data for all posts (this should work for guests too)
		const usersMap = new Map();
		if (userIds.size > 0) {
			try {
				const userIdArray = Array.from(userIds);
				const usersResult = await pbTryCatch(
					pb.collection('users').getList(1, userIdArray.length, {
						filter: userIdArray.map(id => `id = "${id}"`).join(' || '),
						fields: 'id,username,name,avatar'
					}),
					'fetch post authors'
				);
				
				if (usersResult.success) {
					usersResult.data.items.forEach(user => {
						usersMap.set(user.id, user);
					});
				}
			} catch (error) {
				console.warn('Could not fetch user data for posts:', error);
			}
		}

		// Now set author data with fallbacks
		allPosts.forEach((post) => {
			// First try to use expanded user data
			if (post.expand?.user) {
				post.author_name = post.expand.user.name;
				post.author_username = post.expand.user.username;
				post.author_avatar = post.expand.user.avatar;
			} 
			// Fallback to separately fetched user data
			else if (post.user && usersMap.has(post.user)) {
				const userData = usersMap.get(post.user);
				post.author_name = userData.name;
				post.author_username = userData.username;
				post.author_avatar = userData.avatar;
			}
			// Final fallback - ensure we have at least basic data
			else {
				post.author_name = post.author_name || 'User';
				post.author_username = post.author_username || 'user';
				post.author_avatar = post.author_avatar || null;
			}
		});

		// Sort by created date
		allPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		console.log('Combined posts for this page:', allPosts.length);
		console.log('Reposts in combined:', allPosts.filter((p) => p.isRepost).length);

		// Get user profile if exists (only on first page)
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
			} else {
				console.log('No profile found for user');
			}
		}

		// Calculate total posts (only on first page for performance)
		let totalPosts = 0;
		if (offset === 0) {
			try {
				// Get total count of user's posts for accurate pagination
				const totalOriginalPosts = await pb.collection('posts').getList(1, 1, {
					filter: `user = "${user.id}"`,
					fields: 'id'
				});

				const totalRepostedPosts = await pb.collection('posts').getList(1, 1, {
					filter: `repostedBy ~ "${user.id}" && user != "${user.id}"`,
					fields: 'id'
				});

				totalPosts = totalOriginalPosts.totalItems + totalRepostedPosts.totalItems;
			} catch (err) {
				console.warn('Could not get total post count:', err);
				totalPosts = allPosts.length; // Fallback
			}
		}

		console.log('API/[username]: Returning', allPosts.length, 'posts for page', page);

		return {
			user: {
				id: user.id,
				username: user.username,
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				description: user.description,
				profileWallpaper: user.profileWallpaper,
				wallpaper_preference: user.wallpaper_preference,
				status: user.status || 'offline',
				last_login: user.last_login || '',
				followers: user.followers || [],
				following: user.following || [],
				location: user.location,
				website: user.website,
				created: user.created,
				updated: user.updated
			},
			profile: offset === 0 ? profile : undefined,
			posts: allPosts,
			totalPosts: totalPosts || allPosts.length,
			currentPage: page,
			hasMore: allPosts.length === limit
		};
	}, 'Failed to fetch user profile');
};
