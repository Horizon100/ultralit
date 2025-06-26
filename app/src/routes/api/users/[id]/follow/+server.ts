import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PublicUserProfile } from '$lib/types/types';

// Helper function to convert user record to PublicUserProfile
function userToPublicProfile(user: any): PublicUserProfile {
	return {
		id: user.id,
		username: user.username || '',
		name: user.name || '',
		email: user.email || '',
		avatar: user.avatar || '',
		avatarUrl: user.avatar ? pb.files.getUrl(user, user.avatar) : null,
		verified: user.verified || false,
		description: user.description || '',
		role: user.role || 'user',
		last_login: user.last_login || '',
		perks: user.perks || [],
		taskAssignments: user.taskAssignments || [],
		userTaskStatus: user.userTaskStatus || {
			backlog: 0,
			todo: 0,
			focus: 0,
			done: 0,
			hold: 0,
			postpone: 0,
			cancel: 0,
			review: 0,
			delegate: 0,
			archive: 0
		},
		userProjects: user.userProjects || [],
		hero: user.hero || '',
		created: user.created
	};
}

// GET: Fetch followers and following for a user
export const GET: RequestHandler = async ({ params }) => {
	const targetUserId = params.id;

	try {
		// Get the target user to access their followers and following arrays
		const targetUser = await pb.collection('users').getOne(targetUserId, {
			fields: 'id,followers,following'
		});

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		const followerIds = targetUser.followers || [];
		const followingIds = targetUser.following || [];

		// Fetch follower profiles
		let followers: PublicUserProfile[] = [];
		if (followerIds.length > 0) {
			const followerFilter = followerIds.map((id: string) => `id = "${id}"`).join(' || ');
			const followerRecords = await pb.collection('users').getList(1, 100, {
				filter: followerFilter,
				fields: 'id,username,name,email,avatar,verified,description,role,last_login,perks,taskAssignments,userTaskStatus,userProjects,hero,created'
			});
			followers = followerRecords.items.map(userToPublicProfile);
		}

		// Fetch following profiles
		let following: PublicUserProfile[] = [];
		if (followingIds.length > 0) {
			const followingFilter = followingIds.map((id: string) => `id = "${id}"`).join(' || ');
			const followingRecords = await pb.collection('users').getList(1, 100, {
				filter: followingFilter,
				fields: 'id,username,name,email,avatar,verified,description,role,last_login,perks,taskAssignments,userTaskStatus,userProjects,hero,created'
			});
			following = followingRecords.items.map(userToPublicProfile);
		}

		return json({
			success: true,
			data: {
				followers,
				following,
				followerCount: followers.length,
				followingCount: following.length
			}
		});
	} catch (err) {
		console.error('Error fetching follow data:', err);
		throw error(500, 'Failed to fetch follow data');
	}
};

// POST: Follow or unfollow a user
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const targetUserId = params.id;
	const currentUser = locals.user;

	if (!currentUser) {
		throw error(401, 'Authentication required');
	}

	if (currentUser.id === targetUserId) {
		throw error(400, 'Cannot follow yourself');
	}

	try {
		const data = await request.json();
		const { action } = data;

		if (!action || !['follow', 'unfollow'].includes(action)) {
			throw error(400, 'Invalid action. Must be "follow" or "unfollow"');
		}

		// Get both users
		const [currentUserRecord, targetUserRecord] = await Promise.all([
			pb.collection('users').getOne(currentUser.id, {
				fields: 'id,following'
			}),
			pb.collection('users').getOne(targetUserId, {
				fields: 'id,followers'
			})
		]);

		if (!targetUserRecord) {
			throw error(404, 'Target user not found');
		}

		const currentFollowing = currentUserRecord.following || [];
		const targetFollowers = targetUserRecord.followers || [];

		let updatedFollowing: string[];
		let updatedFollowers: string[];
		let isFollowing: boolean;

		if (action === 'follow') {
			// Add to following/followers if not already present
			if (!currentFollowing.includes(targetUserId)) {
				updatedFollowing = [...currentFollowing, targetUserId];
				updatedFollowers = [...targetFollowers, currentUser.id];
				isFollowing = true;
			} else {
				// Already following
				updatedFollowing = currentFollowing;
				updatedFollowers = targetFollowers;
				isFollowing = true;
			}
		} else {
			// Remove from following/followers
			updatedFollowing = currentFollowing.filter((id: string) => id !== targetUserId);
			updatedFollowers = targetFollowers.filter((id: string) => id !== currentUser.id);
			isFollowing = false;
		}

		// Update both users
		await Promise.all([
			pb.collection('users').update(currentUser.id, {
				following: updatedFollowing
			}),
			pb.collection('users').update(targetUserId, {
				followers: updatedFollowers
			})
		]);

		console.log(`✅ User ${currentUser.id} ${action}ed user ${targetUserId}`);

		return json({
			success: true,
			data: {
				action,
				isFollowing,
				followerCount: updatedFollowers.length,
				followingCount: updatedFollowing.length
			}
		});
	} catch (err) {
		console.error('Error updating follow relationship:', err);
		
		// Log detailed error information
		if (err && typeof err === 'object') {
			console.error('Full error object:', JSON.stringify(err, null, 2));
			if ('response' in err) {
				console.error('Error response:', err.response);
			}
		}
		
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Failed to update follow relationship'
			},
			{ status: 400 }
		);
	}
};