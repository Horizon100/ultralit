import { writable } from 'svelte/store';
import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';
import type { User, PublicUserProfile } from '$lib/types/types';

export interface FollowRelationship {
	userId: string;
	targetUserId: string;
	isFollowing: boolean;
	isFollower: boolean;
	lastUpdated: number;
}

export interface FollowData {
	followers: PublicUserProfile[];
	following: PublicUserProfile[];
	relationships: Map<string, FollowRelationship>;
	lastFetched: number;
}

// Store for tracking follow relationships
export const followStore = writable<Map<string, FollowData>>(new Map());

// Cache duration for follow data (5 minutes)
const FOLLOW_CACHE_DURATION = 5 * 60 * 1000;

// Function to get follow data for a user
export async function fetchFollowData(userId: string, forceRefresh: boolean = false): Promise<FollowData | null> {
	console.log('🔍 fetchFollowData called with userId:', userId, 'forceRefresh:', forceRefresh);
	
	// Check cache first unless force refresh
	if (!forceRefresh) {
		let cachedData: FollowData | null = null;
		followStore.subscribe(dataMap => {
			const cached = dataMap.get(userId);
			if (cached && Date.now() - cached.lastFetched < FOLLOW_CACHE_DURATION) {
				cachedData = cached;
			}
		})();
		
		if (cachedData) {
			console.log('📋 Using cached follow data for user:', userId);
			return cachedData;
		}
	}

	console.log('🌐 Making API request for follow data:', userId);
	
	const result = await fetchTryCatch<{
		success: boolean;
		data?: {
			followers: PublicUserProfile[];
			following: PublicUserProfile[];
			followerCount: number;
			followingCount: number;
		};
		error?: string;
	}>(
		`/api/users/${userId}/follow`,
		{
			method: 'GET',
			credentials: 'include',
			headers: {
				'Accept': 'application/json',
				'Cache-Control': 'no-cache'
			}
		},
		10000 // 10 second timeout
	);

	if (!isSuccess(result)) {
		console.error('❌ Error fetching follow data:', result.error);
		return null;
	}

	console.log('📥 Raw follow API response:', result.data);
	const responseData = result.data;
	
	if (!responseData.success || !responseData.data) {
		console.error('❌ Invalid follow response structure:', responseData);
		return null;
	}

	const { followers, following } = responseData.data;
	
	// Create relationship map
	const relationships = new Map<string, FollowRelationship>();
	
	// Add follower relationships
	followers.forEach(follower => {
		relationships.set(follower.id, {
			userId,
			targetUserId: follower.id,
			isFollowing: following.some(f => f.id === follower.id),
			isFollower: true,
			lastUpdated: Date.now()
		});
	});
	
	// Add following relationships (if not already added)
	following.forEach(followedUser => {
		if (!relationships.has(followedUser.id)) {
			relationships.set(followedUser.id, {
				userId,
				targetUserId: followedUser.id,
				isFollowing: true,
				isFollower: false,
				lastUpdated: Date.now()
			});
		} else {
			// Update existing relationship
			const existing = relationships.get(followedUser.id)!;
			existing.isFollowing = true;
		}
	});

	const followData: FollowData = {
		followers,
		following,
		relationships,
		lastFetched: Date.now()
	};

	console.log('✅ Processed follow data:', {
		followers: followers.length,
		following: following.length,
		relationships: relationships.size
	});

	// Update the store
	followStore.update(dataMap => {
		dataMap.set(userId, followData);
		console.log('💾 Updated follow store. Store size:', dataMap.size);
		return new Map(dataMap);
	});

	return followData;
}

// Function to follow/unfollow a user
export async function toggleFollowUser(currentUserId: string, targetUserId: string, action: 'follow' | 'unfollow'): Promise<boolean> {
	console.log(`🔄 ${action} user:`, { currentUserId, targetUserId });
	
	const result = await fetchTryCatch<{
		success: boolean;
		data?: {
			action: 'follow' | 'unfollow';
			isFollowing: boolean;
			followerCount: number;
			followingCount: number;
		};
		error?: string;
	}>(
		`/api/users/${targetUserId}/follow`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ action })
		},
		10000
	);

	if (!isSuccess(result)) {
		console.error(`❌ Error ${action}ing user:`, result.error);
		return false;
	}

	const responseData = result.data;
	const success = responseData.success && responseData.data;
	
	if (success) {
		console.log(`✅ Successfully ${action}ed user`);
		
		// Update the store to reflect the change
		followStore.update(dataMap => {
			// Update current user's follow data
			const currentUserData = dataMap.get(currentUserId);
			if (currentUserData) {
				if (action === 'follow') {
					// Add to following list if not already there
					if (!currentUserData.following.some(u => u.id === targetUserId)) {
						// We would need to fetch target user's profile to add to following
						// For now, we'll mark the data as stale by clearing it
						dataMap.delete(currentUserId);
					}
				} else {
					// Remove from following list
					currentUserData.following = currentUserData.following.filter(u => u.id !== targetUserId);
					currentUserData.relationships.delete(targetUserId);
				}
			}
			
			// Update target user's follow data if present
			const targetUserData = dataMap.get(targetUserId);
			if (targetUserData) {
				if (action === 'follow') {
					// Current user is now a follower of target user
					// We would need current user's profile to add to followers
					// For now, we'll mark the data as stale by clearing it
					dataMap.delete(targetUserId);
				} else {
					// Remove current user from target's followers
					targetUserData.followers = targetUserData.followers.filter(u => u.id !== currentUserId);
					targetUserData.relationships.delete(currentUserId);
				}
			}
			
			return new Map(dataMap);
		});
	}
	
	return success;
}

// Function to get followers for a user
export function getFollowers(userId: string): PublicUserProfile[] {
	let followers: PublicUserProfile[] = [];
	
	followStore.subscribe(dataMap => {
		const data = dataMap.get(userId);
		if (data) {
			followers = data.followers;
		}
	})();

	return followers;
}

// Function to get following for a user
export function getFollowing(userId: string): PublicUserProfile[] {
	let following: PublicUserProfile[] = [];
	
	followStore.subscribe(dataMap => {
		const data = dataMap.get(userId);
		if (data) {
			following = data.following;
		}
	})();

	return following;
}

// Function to check if user A is following user B
export function isFollowing(userAId: string, userBId: string): boolean {
	let following = false;
	
	followStore.subscribe(dataMap => {
		const data = dataMap.get(userAId);
		if (data) {
			following = data.following.some(user => user.id === userBId);
		}
	})();

	return following;
}

// Function to get relationship between two users
export function getRelationship(userId: string, targetUserId: string): FollowRelationship | null {
	let relationship: FollowRelationship | null = null;
	
	followStore.subscribe(dataMap => {
		const data = dataMap.get(userId);
		if (data) {
			relationship = data.relationships.get(targetUserId) || null;
		}
	})();

	return relationship;
}

// Function to refresh follow data
export async function refreshFollowData(userId: string): Promise<FollowData | null> {
	console.log('🔄 Force refreshing follow data for user:', userId);
	return fetchFollowData(userId, true);
}

// Function to clear follow data for a user
export function clearFollowData(userId: string): void {
	console.log('🗑️ Clearing follow data for user:', userId);
	followStore.update(dataMap => {
		dataMap.delete(userId);
		return new Map(dataMap);
	});
}

// Function to clear all follow data
export function clearAllFollowData(): void {
	console.log('🗑️ Clearing all follow data');
	followStore.set(new Map());
}

// Function to start periodic follow data polling
export function startFollowPolling(userId: string, intervalMs: number = 5 * 60 * 1000): () => void {
	console.log('⏰ Starting follow polling for user:', userId, 'interval:', intervalMs);
	
	// Initial fetch
	fetchFollowData(userId);

	// Set up polling
	const interval = setInterval(() => {
		console.log('🔄 Polling follow data for user:', userId);
		fetchFollowData(userId, false);
	}, intervalMs);

	// Return cleanup function
	return () => {
		console.log('🛑 Stopping follow polling for user:', userId);
		clearInterval(interval);
	};
}

// Function to clear expired cache entries
export function clearExpiredFollowCache(): void {
	const now = Date.now();
	followStore.update(dataMap => {
		for (const [userId, followData] of dataMap.entries()) {
			if (now - followData.lastFetched > FOLLOW_CACHE_DURATION * 2) {
				dataMap.delete(userId);
				console.log('🗑️ Removed expired follow cache for user:', userId);
			}
		}
		return new Map(dataMap);
	});
}

// Debug function to log store contents
export function debugFollowStore(): void {
	followStore.subscribe(dataMap => {
		console.log('🐛 Follow Store Debug:');
		console.log('📊 Store size:', dataMap.size);
		console.log('👥 Users in store:', Array.from(dataMap.keys()));
		for (const [userId, data] of dataMap.entries()) {
			console.log(`📋 User ${userId}:`, {
				followers: data.followers.length,
				following: data.following.length,
				relationships: data.relationships.size,
				lastFetched: new Date(data.lastFetched).toISOString()
			});
		}
	})();
}