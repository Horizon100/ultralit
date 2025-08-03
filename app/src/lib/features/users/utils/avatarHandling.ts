// lib/features/users/utils/avatarHandling.ts
import { get } from 'svelte/store';
import { pocketbaseUrl } from '$lib/stores/pocketbase';
import type { User, AIAgent } from '$lib/types/types';
import { generateUserIdenticon, getUserIdentifier } from '$lib/utils/identiconUtils';

export interface AvatarUser {
	id: string;
	avatar?: string;
	avatarUrl?: string;
	collectionId?: string;
	email?: string;
	username?: string;
	name?: string;
}

const avatarUrlCache = new Map<string, string>();
export function getAvatarUrl(user: AvatarUser | null): string | null {
	if (!user?.avatar) return '';

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

export function getAvatarUrlWithFallback(user: AvatarUser | null, size: number = 64): string {
	if (!user) return '';

	const uploadedAvatar = getAvatarUrl(user);

	if (!uploadedAvatar) {
		return generateUserIdenticon(getUserIdentifier(user), size);
	}

	return uploadedAvatar;
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

	if (expandedUser.avatar.startsWith('http')) {
		return expandedUser.avatar;
	}

	const currentPocketbaseUrl = get(pocketbaseUrl);
	let avatarUrl = `${currentPocketbaseUrl}/api/files/_pb_users_auth_/${expandedUser.id}/${expandedUser.avatar}`;

	if (timestamp) {
		avatarUrl = `${avatarUrl}?t=${timestamp}`;
	}

	return avatarUrl;
}

export function getExpandedUserAvatarUrlWithFallback(
	expandedUser: {
		id: string;
		name?: string;
		username?: string;
		avatar?: string;
		email?: string;
	},
	timestamp?: number,
	size: number = 64
): string {
	const uploadedAvatar = getExpandedUserAvatarUrl(expandedUser, timestamp);

	if (!uploadedAvatar) {
		return generateUserIdenticon(getUserIdentifier(expandedUser), size);
	}

	return uploadedAvatar;
}

const agentAvatarUrlCache = new Map<string, string>();

export function getAgentAvatarUrl(agent: AIAgent): string {
	if (!agent) return '';

	const cacheKey = `${agent.id}-${agent.avatar}`;

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

	if (typeof avatar === 'string' && avatar.startsWith('http')) {
		avatarUrl = avatar;
	} else if (typeof avatar === 'string') {
		const currentPocketbaseUrl = get(pocketbaseUrl);
		avatarUrl = `${currentPocketbaseUrl}/api/files/${collectionId}/${agentId}/${avatar}`;
	}

	agentAvatarUrlCache.set(cacheKey, avatarUrl);

	return avatarUrl;
}
