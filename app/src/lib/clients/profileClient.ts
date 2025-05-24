import { pocketbaseUrl } from '$lib/pocketbase';
import type { UserProfile, PublicUserProfile } from '$lib/types/types';

const userProfileCache: Map<string, UserProfile | null> = new Map();
const publicUserProfileCache: Map<string, PublicUserProfile | null> = new Map();

/**
 * Fetches user profile data, with caching
 * @param userId - The ID of the user to fetch
 * @returns Promise<UserProfile | null> - The user profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
	// Check if already in cache
	if (userProfileCache.has(userId)) {
		return userProfileCache.get(userId) || null;
	}

	try {
		// Use your API endpoint instead of direct PocketBase access
		const response = await fetch(`/api/verify/users/${userId}/public`, {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			userProfileCache.set(userId, null);
			return null;
		}

		const data = await response.json();

		if (!data.success || !data.user) {
			userProfileCache.set(userId, null);
			return null;
		}

		const userData = data.user;

		// Create profile object from user data
		const profile: UserProfile = {
			id: userData.id,
			name: userData.name || userData.name || 'User',
			avatarUrl: userData.avatar
				? `${pocketbaseUrl}/api/files/users/${userData.id}/${userData.avatar}`
				: ''
		};

		// Store in cache
		userProfileCache.set(userId, profile);
		return profile;
	} catch (error) {
		console.error('Error fetching user profile:', error);
		userProfileCache.set(userId, null);
		return null;
	}
}

/**
 * Fetches detailed public user profile with additional fields
 * @param userId - The ID of the user to fetch
 * @returns Promise with the public user profile or null if not found
 */
export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
	// Check if already in cache
	if (publicUserProfileCache.has(userId)) {
		return publicUserProfileCache.get(userId) ?? null;
	}

	try {
		// Use the new public profile endpoint
		const response = await fetch(`/api/users/${userId}/public`, {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			publicUserProfileCache.set(userId, null);
			return null;
		}

		const data = await response.json();

		// Create profile object with processed avatar URL
		const publicProfile: PublicUserProfile = {
			...data,
			avatarUrl: data.avatar ? `${pocketbaseUrl}/api/files/users/${data.id}/${data.avatar}` : null
		};

		// Store in cache
		publicUserProfileCache.set(userId, publicProfile);
		return publicProfile;
	} catch (error) {
		console.error('Error fetching public user profile:', error);
		publicUserProfileCache.set(userId, null);
		return null;
	}
}

/**
 * Batch fetch multiple public user profiles with fallback to individual fetches
 * @param userIds - Array of user IDs to fetch
 * @returns Promise with an array of public user profiles
 */
export async function getPublicUserProfiles(
	userIds: string[]
): Promise<(PublicUserProfile | null)[]> {
	// Filter out IDs that are already in cache
	const uncachedIds = userIds.filter((id) => !publicUserProfileCache.has(id));

	// If we have uncached IDs, fetch them
	if (uncachedIds.length > 0) {
		try {
			// Try to use batch endpoint
			const response = await fetch(`/api/users/public/batch`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userIds: uncachedIds })
			});

			if (response.ok) {
				const profiles = await response.json();

				// Process and cache each profile
				profiles.forEach((profile: PublicUserProfile & { avatar?: string }) => {
					// Process avatar URL if needed
					if (profile.avatar) {
						profile.avatarUrl = `${pocketbaseUrl}/api/files/users/${profile.id}/${profile.avatar}`;
					} else {
						profile.avatarUrl = null;
					}

					publicUserProfileCache.set(profile.id, profile);
				});
			} else if (response.status === 404) {
				// Fallback: If batch endpoint doesn't exist, fetch individually
				console.log('Batch endpoint not found, falling back to individual fetches');

				// Fetch profiles individually (limit concurrency to 3)
				const fetchProfile = async (userId: string) => {
					try {
						const profile = await getPublicUserProfile(userId);
						return { userId, profile };
					} catch (err) {
						console.error(`Error fetching profile for ${userId}:`, err);
						return { userId, profile: null };
					}
				};

				// Process in batches of 3 to avoid too many concurrent requests
				const batchSize = 3;
				for (let i = 0; i < uncachedIds.length; i += batchSize) {
					const batch = uncachedIds.slice(i, i + batchSize);
					const results = await Promise.all(batch.map(fetchProfile));

					results.forEach(({ userId, profile }) => {
						publicUserProfileCache.set(userId, profile);
					});
				}
			}
		} catch (error) {
			console.error('Error batch fetching public user profiles:', error);
		}
	}

	// Return all requested profiles from cache
	return userIds.map((id) => publicUserProfileCache.get(id) || null);
}

/**
 * Clear all profile caches
 */
export function clearUserProfileCache(): void {
	userProfileCache.clear();
	publicUserProfileCache.clear();
}

/**
 * Remove a specific user from all caches
 * @param userId - The ID of the user to remove from cache
 */
export function removeUserFromCache(userId: string): void {
	userProfileCache.delete(userId);
	publicUserProfileCache.delete(userId);
}

/**
 * Get cache sizes for debugging
 */
export function getProfileCacheSizes(): { basic: number; public: number } {
	return {
		basic: userProfileCache.size,
		public: publicUserProfileCache.size
	};
}

// Keep existing function for backward compatibility
export function getProfileCacheSize(): number {
	return userProfileCache.size;
}
