// lib/features/users/utils/avatarHandling.ts
import { get } from 'svelte/store';
import { pocketbaseUrl } from '$lib/stores/pocketbase'; // Updated import
import type { User, AIAgent } from '$lib/types/types';
export interface AvatarUser {
	id: string;
	avatar?: string;
	avatarUrl?: string;
	collectionId?: string;
}

const avatarUrlCache = new Map<string, string>();

export function getAvatarUrl(user: AvatarUser): string {
	if (!user) return '';

	const cacheKey = `${user.id}-${user.avatar}`;
	const cachedUrl = avatarUrlCache.get(cacheKey);
	if (cachedUrl !== undefined) {
		return cachedUrl;
	}

	const avatar = user.avatar || user.avatarUrl;
	const userId = user.id;
	const collectionId = user.collectionId || '_pb_users_auth_';

	if (!avatar || !userId || avatar === 'uploaded') {
		avatarUrlCache.set(cacheKey, '');
		return '';
	}

	let avatarUrl = '';

	if (typeof avatar === 'string' && avatar.startsWith('http')) {
		avatarUrl = avatar;
	} else if (typeof avatar === 'string') {
		const baseUrl = get(pocketbaseUrl);
		avatarUrl = `${baseUrl}/api/files/${collectionId}/${userId}/${avatar}`;
	}

	avatarUrlCache.set(cacheKey, avatarUrl);
	return avatarUrl;
}
export function getExpandedUserAvatarUrl(
	expandedUser: {
		id: string;
		name?: string;
		username?: string;
		avatar?: string;
	},
	timestamp?: number
): string {
	if (!expandedUser?.avatar || !expandedUser?.id || expandedUser.avatar === 'uploaded') {
		return '';
	}

	// If avatar is already a full URL, use it
	if (expandedUser.avatar.startsWith('http')) {
		return expandedUser.avatar;
	}

	// Get current pocketbase URL from store
	const currentPocketbaseUrl = get(pocketbaseUrl);
	// Build the avatar URL from PocketBase
	let avatarUrl = `${currentPocketbaseUrl}/api/files/_pb_users_auth_/${expandedUser.id}/${expandedUser.avatar}`;

	// Add timestamp for cache busting if provided
	if (timestamp) {
		avatarUrl = `${avatarUrl}?t=${timestamp}`;
	}

	return avatarUrl;
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

	if (!avatar || !agentId || avatar === 'uploaded') {
		agentAvatarUrlCache.set(cacheKey, '');
		return '';
	}

	let avatarUrl = '';

	// If avatar is already a full URL, use it
	if (typeof avatar === 'string' && avatar.startsWith('http')) {
		avatarUrl = avatar;
	} else if (typeof avatar === 'string') {
		// Get current pocketbase URL from store
		const currentPocketbaseUrl = get(pocketbaseUrl);
		// Build the avatar URL from PocketBase
		avatarUrl = `${currentPocketbaseUrl}/api/files/${collectionId}/${agentId}/${avatar}`;
	}

	// Cache the result
	agentAvatarUrlCache.set(cacheKey, avatarUrl);

	return avatarUrl;
}
