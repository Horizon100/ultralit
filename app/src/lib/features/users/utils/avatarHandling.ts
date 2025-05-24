import { pocketbaseUrl } from "$lib/pocketbase";
import type { User } from "$lib/types/types";
const avatarUrlCache = new Map<string, string>();

export function getAvatarUrl(user: User): string {
  if (!user) return '';
  
  const cacheKey = `${user.id}-${user.avatar}`;
  
  // Return cached URL if available
  if (avatarUrlCache.has(cacheKey)) {
    return avatarUrlCache.get(cacheKey)!;
  }
  
  const avatar = user.avatar || user.avatarUrl;
  const userId = user.id;
  const collectionId = user.collectionId || 'users';
  
  if (!avatar || !userId) {
    avatarUrlCache.set(cacheKey, '');
    return '';
  }
  
  let avatarUrl = '';
  
  // If avatarUrl is already a full URL, use it
  if (typeof avatar === 'string' && avatar.startsWith('http')) {
    avatarUrl = avatar;
  } else if (typeof avatar === 'string') {
    // Build the avatar URL from PocketBase
    avatarUrl = `${pocketbaseUrl}/api/files/${collectionId}/${userId}/${avatar}`;
  }
  
  // Cache the result
  avatarUrlCache.set(cacheKey, avatarUrl);
  
  return avatarUrl;
}