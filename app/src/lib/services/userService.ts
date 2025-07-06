import { get } from 'svelte/store';
import { currentUser, getUserById, getPublicUsersBatch } from '$lib/pocketbase';
import { pocketbaseUrl } from '$lib/stores/pocketbase';

import { handleFavoriteThread } from '$lib/utils/favoriteHandlers';
import type {
	User,
	UserProfile,
	Threads,
	InternalChatMessage,
	PublicUserProfile
} from '$lib/types/types';

// Rate limiting and request management
class RequestManager {
	private static pendingRequests = new Map<string, Promise<unknown>>();
	private static rateLimitBackoff = 0;
	private static lastRequestTime = 0;
	private static requestQueue: Array<() => Promise<unknown>> = [];
	private static isProcessingQueue = false;

	static getAvatarUrl(user: User | PublicUserProfile): string {
		if (!user) return '';

		// If avatarUrl is already provided (e.g., from social login)
		if (user.avatarUrl) return user.avatarUrl;

		// For PocketBase avatars
		if (user.avatar) {
			// Type guard to check if user has collectionId (User type)
			if ('collectionId' in user && user.collectionId) {
				return `${pocketbaseUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
			} else {
				// Fallback for PublicUserProfile (no collectionId)
				return `${pocketbaseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`;
			}
		}

		// Fallback - no avatar
		return '';
	}
	/**
	 * Debounce requests to prevent duplicate calls
	 */
	static async debouncedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
		// If request is already pending, wait for it
		if (this.pendingRequests.has(key)) {
			return this.pendingRequests.get(key) as Promise<T>;
		}

		// Create new request promise
		const requestPromise = this.executeWithRateLimit(requestFn);
		this.pendingRequests.set(key, requestPromise);

		try {
			const result = await requestPromise;
			this.pendingRequests.delete(key);
			return result;
		} catch (error) {
			this.pendingRequests.delete(key);
			throw error;
		}
	}
	/**
	 * Execute request with rate limiting protection
	 */
	private static async executeWithRateLimit<T>(requestFn: () => Promise<T>): Promise<T> {
		// Check if we're in backoff period
		if (this.rateLimitBackoff > Date.now()) {
			const waitTime = this.rateLimitBackoff - Date.now();
			console.log(`Rate limited, waiting ${waitTime}ms before retry`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		// Ensure minimum time between requests
		const timeSinceLastRequest = Date.now() - this.lastRequestTime;
		const minInterval = 100; // 100ms minimum between requests

		if (timeSinceLastRequest < minInterval) {
			await new Promise((resolve) => setTimeout(resolve, minInterval - timeSinceLastRequest));
		}

		this.lastRequestTime = Date.now();

		try {
			const result = await requestFn();
			// Reset backoff on success
			this.rateLimitBackoff = 0;
			return result;
		} catch (error: unknown) {
			if (
				error &&
				typeof error === 'object' &&
				'status' in error &&
				(error as { status: number }).status === 429
			) {
				// Exponential backoff for rate limiting
				const backoffTime = Math.min(30000, 1000 * Math.pow(2, Math.random())); // Max 30s
				this.rateLimitBackoff = Date.now() + backoffTime;
				console.log(`Rate limited! Backing off for ${backoffTime}ms`);
			}
			throw error;
		}
	}

	/**
	 * Clear all pending requests (useful for cleanup)
	 */
	static clearPendingRequests(): void {
		this.pendingRequests.clear();
		this.rateLimitBackoff = 0;
	}
}

export class UserService {
	private static userProfileCache: Map<string, UserProfile | null> = new Map();
	private static cacheTimestamps: Map<string, number> = new Map();
	private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
	private static batchRequestTimer: ReturnType<typeof setTimeout> | null = null;
	private static pendingBatchUsers: Set<string> = new Set();
	private static isCurrentlyBatching = false;

	/**
	 * Preloads user profiles for messages with deduplication
	 */
	static async preloadUserProfiles(messages: InternalChatMessage[]): Promise<void> {
		const userIds = new Set<string>();

		messages.forEach((message) => {
			if (message.role === 'user' && message.user) {
				// Only add if not cached or cache is stale
				if (!this.isUserCached(message.user)) {
					userIds.add(message.user);
				}
			}
		});

		if (userIds.size === 0) {
			console.log('All user profiles already cached');
			return;
		}

		console.log(`Preloading ${userIds.size} user profiles`);

		// Use batched approach for better performance
		await this.batchFetchUsers(Array.from(userIds));
	}
	static transformUserToProfile(user: User | null): UserProfile | null {
		if (!user) return null;

		return {
			id: user.id,
			name: user.name || user.username || '',
			username: user.username,
			email: user.email,
			avatar: user.avatar,
			avatarUrl: this.getAvatarUrl(user)
		};
	}
	static transformPublicUserToProfile(user: PublicUserProfile | null): UserProfile | null {
		if (!user) return null;

		return {
			id: user.id,
			name: user.name || user.username,
			username: user.username,
			email: user.email,
			avatar: user.avatar,
			avatarUrl: user.avatarUrl || this.getAvatarUrl(user)
		};
	}
/**
	 * Preloads user profiles using batch fetching with improved caching
	 */
	static async preloadUserProfilesBatch(messages: InternalChatMessage[]): Promise<void> {
		// Prevent multiple simultaneous batch requests
		if (this.isCurrentlyBatching) {
			console.log('Batch request already in progress, skipping...');
			return;
		}

		const userIds = new Set<string>();

		messages.forEach((message) => {
			if (message.role === 'user' && message.user) {
				// Only add if not cached or cache is stale
				if (!this.isUserCached(message.user)) {
					userIds.add(message.user);
				}
			}
		});

		if (userIds.size === 0) {
			console.log('All user profiles already cached');
			return;
		}

		console.log(`Need to load ${userIds.size} user profiles`);

		// Set flag to prevent concurrent requests
		this.isCurrentlyBatching = true;
		try {
			await this.debouncedBatchFetch(Array.from(userIds));
		} finally {
			this.isCurrentlyBatching = false;
		}
	}

	/**
	 * Debounced batch fetching to prevent multiple simultaneous requests
	 */
	private static async debouncedBatchFetch(userIds: string[]): Promise<void> {
		// Add to pending batch
		userIds.forEach((id) => this.pendingBatchUsers.add(id));

		// Clear existing timer
		if (this.batchRequestTimer) {
			clearTimeout(this.batchRequestTimer);
		}

		// Set new timer for batched request
		return new Promise((resolve) => {
			this.batchRequestTimer = setTimeout(async () => {
				const batchIds = Array.from(this.pendingBatchUsers);
				this.pendingBatchUsers.clear();

				if (batchIds.length > 0) {
					console.log(`Executing batch fetch for ${batchIds.length} users`);
					await this.batchFetchUsers(batchIds);
				}
				resolve();
			}, 50); // 50ms debounce
		});
	}

	private static async batchFetchUsers(userIds: string[]): Promise<void> {
		if (userIds.length === 0) return;

		const cacheKey = `batch_${userIds.sort().join(',')}`;

		try {
			await RequestManager.debouncedRequest(cacheKey, async () => {
				console.log(`Batch fetching ${userIds.length} users:`, userIds);

				// This is where the API call happens - make sure it doesn't loop
				const profiles = await getPublicUsersBatch(userIds);

				// Update cache with fetched profiles
				userIds.forEach((userId, index) => {
					const partialUser = profiles[index] || null;
					const publicProfile = partialUser ? this.convertUserToPublicProfile(partialUser) : null;
					this.userProfileCache.set(userId, this.transformPublicUserToProfile(publicProfile));
					this.cacheTimestamps.set(userId, Date.now());
				});

				console.log(`Successfully cached ${userIds.length} user profiles`);
				return profiles;
			});
		} catch (error) {
			console.error('Error in batch fetch users:', error);

			// Cache null results to prevent repeated failed requests
			userIds.forEach((userId) => {
				if (!this.userProfileCache.has(userId)) {
					this.userProfileCache.set(userId, null);
					this.cacheTimestamps.set(userId, Date.now());
				}
			});
		}
	}


	/**
	 * Check if user is cached and cache is fresh
	 */
	private static isUserCached(userId: string): boolean {
		if (!this.userProfileCache.has(userId)) {
			return false;
		}

		const timestamp = this.cacheTimestamps.get(userId);
		if (!timestamp) {
			return false;
		}

		// Check if cache is still fresh
		return Date.now() - timestamp < this.CACHE_TTL;
	}

	/**
	 * Debounced batch fetching to prevent multiple simultaneous requests
	 */


	private static convertUserToPublicProfile(user: Partial<User>): PublicUserProfile | null {
		if (!user.id || !user.username) return null;

		return {
			id: user.id,
			username: user.username,
			name: user.name || '',
			email: user.email || '',
			avatar: user.avatar || '',
			avatarUrl: user.avatarUrl || null,
			verified: user.verified || false,
			description: user.description || '',
			role: user.role || '',
			last_login: user.last_login || new Date().toISOString(),
			perks: [],
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
			userProjects: user.projects || [],
			hero: user.hero || '',
			created: user.created || '',
			location: user.location || '',
			website: user.website || '',
			followers: user.followers || [],
			following: user.following || []
		};
	}


	/**
	 * Checks if a thread is favorited by the current user
	 */
	static isThreadFavorited(threadId?: string): boolean {
		if (!threadId) return false;

		const user = get(currentUser);
		return user?.favoriteThreads?.includes(threadId) || false;
	}

	/**
	 * Handles favoriting/unfavoriting a thread
	 */
	static async onFavoriteThread(
		thread: Threads,
		onStateUpdate?: (threadId: string, newState: boolean) => void,
		onTooltipShow?: (text: string) => void
	): Promise<void> {
		console.log('onFavoriteThread called with:', {
			threadId: thread.id,
			currentUser: get(currentUser),
			favoriteThreads: get(currentUser)?.favoriteThreads
		});

		if (!thread) {
			console.error('No thread provided to onFavoriteThread');
			return;
		}

		const currentIsFavorite = this.isThreadFavorited(thread.id);
		console.log('Current favorite state:', currentIsFavorite);

		try {
			await handleFavoriteThread({
				thread,
				isFavoriteState: currentIsFavorite, // Use the correct property name
				onStateUpdate: (newState: boolean) => {
					console.log('State updated:', { threadId: thread.id, newState });
					onStateUpdate?.(thread.id, newState);
				},
				onTooltipShow: (text: string) => {
					console.log('Tooltip:', text);
					onTooltipShow?.(text);
				}
			});
		} catch (error) {
			console.error('Error in onFavoriteThread:', error);
		}
	}

	/**
	 * Updates the current user's favorite thread state
	 */
	static updateFavoriteThreadState(user: User | null, thread: Threads | null): boolean {
		if (user && Array.isArray(user.favoriteThreads) && thread) {
			return user.favoriteThreads.includes(thread.id);
		}
		return false;
	}

	/**
	 * Gets avatar URL for a user
	 */
	static getAvatarUrl(user: User | PublicUserProfile): string {
		if (!user) return '';

		// If avatarUrl is already provided (e.g., from social login)
		if (user.avatarUrl) return user.avatarUrl;

		// For PocketBase avatars
		if (user.avatar) {
			// Type guard to check if user has collectionId (User type)
			if ('collectionId' in user && user.collectionId) {
				return `${pocketbaseUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
			} else {
				// Fallback for PublicUserProfile (no collectionId)
				return `${pocketbaseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`;
			}
		}

		// Fallback - no avatar
		return '';
	}

	/**
	 * Updates avatar URL for current user
	 */
	static updateAvatarUrl(): string | null {
		const user = get(currentUser);
		if (user && user.avatar) {
			return `${pocketbaseUrl}/api/files/_pb_users_auth_/${user.id}/${user.avatar}`;
		}
		return null;
	}

	/**
	 * Gets user profile from cache or fetches it with rate limiting
	 */
	static async getUserProfile(userId: string): Promise<UserProfile | null> {
		// Check cache first
		if (this.isUserCached(userId)) {
			return this.userProfileCache.get(userId) || null;
		}

		const cacheKey = `single_${userId}`;

		try {
			return await RequestManager.debouncedRequest(cacheKey, async () => {
				console.log(`Fetching single user profile: ${userId}`);
				const user = await getUserById(userId);
				const profile = this.transformUserToProfile(user);
				this.userProfileCache.set(userId, profile);
				this.cacheTimestamps.set(userId, Date.now());
				return profile;
			});
		} catch (error) {
			console.error('Error fetching user profile:', error);
			this.userProfileCache.set(userId, null);
			this.cacheTimestamps.set(userId, Date.now());
			return null;
		}
	}

	/**
	 * Clears user profile cache
	 */
	static clearUserProfileCache(): void {
		this.userProfileCache.clear();
		this.cacheTimestamps.clear();
		RequestManager.clearPendingRequests();

		// Clear any pending timers
		if (this.batchRequestTimer) {
			clearTimeout(this.batchRequestTimer);
			this.batchRequestTimer = null;
		}
		this.pendingBatchUsers.clear();
	}

	/**
	 * Gets user profiles for multiple users with efficient batching
	 */
	static async getUserProfiles(userIds: string[]): Promise<Map<string, UserProfile | null>> {
		const profiles = new Map<string, UserProfile | null>();
		const uncachedIds: string[] = [];

		// Check cache for existing profiles
		userIds.forEach((id) => {
			if (this.isUserCached(id)) {
				profiles.set(id, this.userProfileCache.get(id) || null);
			} else {
				uncachedIds.push(id);
			}
		});

		// Fetch uncached profiles in batches
		if (uncachedIds.length > 0) {
			await this.batchFetchUsers(uncachedIds);

			// Add newly fetched profiles to result
			uncachedIds.forEach((id) => {
				profiles.set(id, this.userProfileCache.get(id) || null);
			});
		}

		return profiles;
	}

	/**
	 * Checks if current user owns a thread
	 */
	static isThreadOwner(thread: Threads, userId?: string): boolean {
		const currentUserId = userId || get(currentUser)?.id;
		if (!currentUserId || !thread) return false;

		return thread.user === currentUserId || thread.op === currentUserId;
	}

	/**
	 * Checks if current user is a member of a thread
	 */
	static isThreadMember(thread: Threads, userId?: string): boolean {
		const currentUserId = userId || get(currentUser)?.id;
		if (!currentUserId || !thread) return false;

		if (!thread.members) return false;

		if (typeof thread.members === 'string') {
			return thread.members.includes(currentUserId);
		}

		if (Array.isArray(thread.members)) {
			return thread.members.some((m: string | { id: string }) =>
				typeof m === 'string' ? m === currentUserId : m.id === currentUserId
			);
		}

		return false;
	}

	/**
	 * Gets user permissions for a thread
	 */
	static getThreadPermissions(thread: Threads, userId?: string) {
		const currentUserId = userId || get(currentUser)?.id;

		return {
			canEdit: this.isThreadOwner(thread, currentUserId),
			canDelete: this.isThreadOwner(thread, currentUserId),
			canInvite: this.isThreadOwner(thread, currentUserId),
			canView:
				this.isThreadOwner(thread, currentUserId) || this.isThreadMember(thread, currentUserId),
			isOwner: this.isThreadOwner(thread, currentUserId),
			isMember: this.isThreadMember(thread, currentUserId)
		};
	}

	/**
	 * Formats user display name
	 */
	static formatUserDisplayName(user: UserProfile): string {
		if (user.name) return user.name;
		if (user.username) return user.username;
		if (user.email) return user.email.split('@')[0];
		return 'Anonymous User';
	}

	/**
	 * Gets user initials for avatar fallback
	 */
	static getUserInitials(user: UserProfile): string {
		const displayName = this.formatUserDisplayName(user);
		const words = displayName.split(' ').filter((word) => word.length > 0);

		if (words.length >= 2) {
			return (words[0][0] + words[1][0]).toUpperCase();
		} else if (words.length === 1) {
			return words[0].slice(0, 2).toUpperCase();
		}

		return 'AU'; // Anonymous User
	}

	/**
	 * Get cache statistics for debugging
	 */
	static getCacheStats() {
		const total = this.userProfileCache.size;
		const fresh = Array.from(this.cacheTimestamps.entries()).filter(
			([, timestamp]) => Date.now() - timestamp < this.CACHE_TTL
		).length;

		return {
			total,
			fresh,
			stale: total - fresh,
			pendingBatch: this.pendingBatchUsers.size
		};
	}
}
