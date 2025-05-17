import { pocketbaseUrl } from '$lib/pocketbase';
import type { UserProfile } from '$lib/types/types';

// Cache for user profiles
const userProfileCache: Map<string, UserProfile | null> = new Map();

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
      avatarUrl: userData.avatar ? `${pocketbaseUrl}/api/files/users/${userData.id}/${userData.avatar}` : null
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
 * Clear the user profile cache
 */
export function clearUserProfileCache(): void {
  userProfileCache.clear();
}

/**
 * Remove a specific user from the cache
 * @param userId - The ID of the user to remove from cache
 */
export function removeUserFromCache(userId: string): void {
  userProfileCache.delete(userId);
}

/**
 * Get cache size for debugging
 */
export function getProfileCacheSize(): number {
  return userProfileCache.size;
}