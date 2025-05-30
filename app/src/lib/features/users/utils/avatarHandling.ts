import { pocketbaseUrl } from '$lib/pocketbase';
import type { User, AIAgent } from '$lib/types/types';
const avatarUrlCache = new Map<string, string>();

export function getAvatarUrl(user: User): string {
	if (!user) return '';

	const cacheKey = `${user.id}-${user.avatar}`;

	// Return cached URL if available
	const cachedUrl = avatarUrlCache.get(cacheKey);
	if (cachedUrl !== undefined) {
		return cachedUrl;
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

export function getExpandedUserAvatarUrl(expandedUser: {
	id: string;
	name?: string;
	username?: string;
	avatar?: string;
}): string {
	if (!expandedUser?.avatar || !expandedUser?.id) {
		return '';
	}

	// If avatar is already a full URL, use it
	if (expandedUser.avatar.startsWith('http')) {
		return expandedUser.avatar;
	}

	// Build the avatar URL from PocketBase
	return `${pocketbaseUrl}/api/files/users/${expandedUser.id}/${expandedUser.avatar}`;
}

const agentAvatarUrlCache = new Map<string, string>();

export function getAgentAvatarUrl(agent: AIAgent): string {
	if (!agent) return '';

	const cacheKey = `${agent.id}-${agent.avatar}`;

	// Return cached URL if available
	if (agentAvatarUrlCache.has(cacheKey)) {
		const cachedUrl = agentAvatarUrlCache.get(cacheKey);
		return cachedUrl || '';
	}

	const avatar = agent.avatar;
	const agentId = agent.id;
	const collectionId = agent.collectionId || 'ai_agents';

	if (!avatar || !agentId) {
		agentAvatarUrlCache.set(cacheKey, '');
		return '';
	}

	let avatarUrl = '';

	// If avatar is already a full URL, use it
	if (typeof avatar === 'string' && avatar.startsWith('http')) {
		avatarUrl = avatar;
	} else if (typeof avatar === 'string') {
		// Build the avatar URL from PocketBase
		avatarUrl = `${pocketbaseUrl}/api/files/${collectionId}/${agentId}/${avatar}`;
	}

	// Cache the result
	agentAvatarUrlCache.set(cacheKey, avatarUrl);

	return avatarUrl;
}