import { pocketbaseUrl } from '$lib/stores/pocketbase';
import type { UserProfile, PublicUserProfile } from '$lib/types/types';
import { fetchTryCatch, clientTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';

const userProfileCache: Map<string, UserProfile | null> = new Map();
const publicUserProfileCache: Map<string, PublicUserProfile | null> = new Map();

type ApiResponse<T> = {
	success?: boolean;
	user?: T;
	data?: T;
	error?: string;
};

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

	// Define the expected user data structure
	interface UserData {
		id: string;
		name?: string;
		username?: string;
		email?: string;
		avatar?: string;
	}

	const result = await clientTryCatch(
		fetchTryCatch<ApiResponse<UserData>>(`/api/users/${userId}`, {
			method: 'GET',
			credentials: 'include'
		}).then((fetchResult) => {
			if (isFailure(fetchResult)) {
				throw new Error(fetchResult.error);
			}
			return fetchResult.data;
		}),
		'Error fetching user profile'
	);

	if (isFailure(result)) {
		userProfileCache.set(userId, null);
		return null;
	}

	// Handle the response structure consistently - properly type the userData
	let userData: UserData;

	if (result.data.user) {
		userData = result.data.user;
	} else if (result.data.data) {
		userData = result.data.data;
	} else {
		// Assume result.data is directly the user data
		userData = result.data as UserData;
	}

	if (!userData || !userData.id) {
		userProfileCache.set(userId, null);
		return null;
	}

	// Create profile object from user data
	const profile: UserProfile = {
		id: userData.id,
		name: userData.name || userData.username || 'User',
		username: userData.username || '',
		email: userData.email || '',
		avatar: userData.avatar || '',
		avatarUrl: userData.avatar
			? `${pocketbaseUrl}/api/files/_pb_users_auth_/${userData.id}/${userData.avatar}`
			: ''
	};

	// Store in cache
	userProfileCache.set(userId, profile);
	return profile;
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

	const result = await clientTryCatch(
		fetchTryCatch<PublicUserProfile>(`/api/users/${userId}/public`, {
			method: 'GET',
			credentials: 'include'
		}).then((fetchResult) => {
			if (isFailure(fetchResult)) {
				throw new Error(fetchResult.error);
			}
			return fetchResult.data;
		}),
		'Error fetching public user profile'
	);

	if (isFailure(result)) {
		publicUserProfileCache.set(userId, null);
		return null;
	}

	// Create profile object with processed avatar URL
	const publicProfile: PublicUserProfile = {
		...result.data,
		avatarUrl: result.data.avatar
			? `${pocketbaseUrl}/api/files/_pb_users_auth_/${result.data.id}/${result.data.avatar}`
			: null
	};

	// Store in cache
	publicUserProfileCache.set(userId, publicProfile);
	return publicProfile;
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
		// Try to use batch endpoint first
		const batchResult = await clientTryCatch(
			fetchTryCatch<PublicUserProfile[]>(`/api/users/public/batch`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userIds: uncachedIds })
			}).then((fetchResult) => {
				if (isFailure(fetchResult)) {
					// Check if it's a 404 (endpoint doesn't exist)
					if (fetchResult.error.includes('404') || fetchResult.error.includes('not found')) {
						throw new Error('BATCH_NOT_FOUND');
					}
					throw new Error(fetchResult.error);
				}
				return fetchResult.data;
			}),
			'Error batch fetching public user profiles'
		);

		if (isSuccess(batchResult)) {
			// Process and cache each profile
			batchResult.data.forEach((profile: PublicUserProfile & { avatar?: string }) => {
				// Process avatar URL if needed
				if (profile.avatar) {
					profile.avatarUrl = `${pocketbaseUrl}/api/files/_pb_users_auth_/${profile.id}/${profile.avatar}`;
				} else {
					profile.avatarUrl = null;
				}

				publicUserProfileCache.set(profile.id, profile);
			});
		} else if (batchResult.error === 'BATCH_NOT_FOUND') {
			// Fallback: If batch endpoint doesn't exist, fetch individually
			console.log('Batch endpoint not found, falling back to individual fetches');

			// Fetch profiles individually (limit concurrency to 3)
			const fetchProfile = async (userId: string) => {
				const profileResult = await clientTryCatch(
					getPublicUserProfile(userId),
					`Error fetching profile for ${userId}`
				);

				return {
					userId,
					profile: isSuccess(profileResult) ? profileResult.data : null
				};
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
		// If other error types, we just continue without caching
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
