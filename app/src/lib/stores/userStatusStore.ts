import { writable } from 'svelte/store';
import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';

export type UserStatus = 'online' | 'offline';

export interface UserStatusInfo {
	userId: string;
	status: UserStatus;
	lastSeen: string | null;
	name: string;
	lastUpdated: number; // Add timestamp for cache management
}

// Store for tracking multiple users' statuses
export const userStatusStore = writable<Map<string, UserStatusInfo>>(new Map());

// Cache duration for status info (30 seconds)
const STATUS_CACHE_DURATION = 30000;

// Function to fetch and update a user's status
export async function fetchUserStatus(userId: string, forceRefresh: boolean = false): Promise<UserStatusInfo | null> {
	console.log('🔍 fetchUserStatus called with userId:', userId, 'forceRefresh:', forceRefresh);
	
	// Check cache first unless force refresh
	if (!forceRefresh) {
		let cachedStatus: UserStatusInfo | null = null;
		userStatusStore.subscribe(statusMap => {
			const cached = statusMap.get(userId);
			if (cached && Date.now() - cached.lastUpdated < STATUS_CACHE_DURATION) {
				cachedStatus = cached;
			}
		})();
		
		if (cachedStatus) {
			console.log('📋 Using cached status for user:', userId, cachedStatus);
			return cachedStatus;
		}
	}

	console.log('🌐 Making API request for user data:', userId);
	
	const result = await fetchTryCatch<{
		success: boolean;
		user?: {
			id: string;
			name: string;
			username: string;
			status: string;
			last_login: string;
		};
		error?: string;
	}>(
		`/api/users/${userId}`, // Changed to use the main user endpoint
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
		console.error('❌ Error fetching user data:', result.error);
		
		// Set as offline if fetch fails
		const offlineStatus: UserStatusInfo = {
			userId,
			status: 'offline',
			lastSeen: null,
			name: 'Unknown User',
			lastUpdated: Date.now()
		};

		userStatusStore.update(statusMap => {
			statusMap.set(userId, offlineStatus);
			console.log('💾 Updated store with offline status. Store size:', statusMap.size);
			return new Map(statusMap);
		});

		return offlineStatus;
	}

	console.log('📥 Raw API response:', result.data);
	const responseData = result.data;
	
	// Handle the response from /api/users/[id]
	if (!responseData.success || !responseData.user) {
		console.error('❌ Invalid response structure:', responseData);
		return null;
	}

	const user = responseData.user;
	const statusInfo: UserStatusInfo = {
		userId: user.id,
		status: user.status === 'online' ? 'online' : 'offline',
		lastSeen: user.last_login,
		name: user.name || user.username || 'Unknown User',
		lastUpdated: Date.now()
	};

	console.log('✅ Processed status info:', statusInfo);

	// Update the store
	userStatusStore.update(statusMap => {
		statusMap.set(userId, statusInfo);
		console.log('💾 Updated store with new status. Store size:', statusMap.size);
		console.log('📊 Store contents:', Array.from(statusMap.entries()));
		return new Map(statusMap);
	});

	return statusInfo;
}

// Function to get status from store
export function getUserStatus(userId: string): UserStatusInfo | null {
	let status: UserStatusInfo | null = null;
	
	userStatusStore.subscribe(statusMap => {
		status = statusMap.get(userId) || null;
	})();

	return status;
}

// Function to update current user's status
export async function updateMyStatus(userId: string, status: UserStatus): Promise<boolean> {
	console.log('🔄 Updating status for user:', userId, 'to:', status);
	
	const result = await fetchTryCatch<{
		success: boolean;
		data?: {
			success: boolean;
			status: UserStatus;
			timestamp: string;
		};
		error?: string;
	}>(
		`/api/users/${userId}/status`,
		{
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ status })
		},
		10000
	);

	if (!isSuccess(result)) {
		console.error('❌ Error updating status:', result.error);
		return false;
	}

	const responseData = result.data;
	const success = responseData.success && responseData.data?.success;
	
	if (success) {
		// Update the store with the new status
		userStatusStore.update(statusMap => {
			const existing = statusMap.get(userId);
			if (existing) {
				statusMap.set(userId, {
					...existing,
					status,
					lastUpdated: Date.now()
				});
			}
			return new Map(statusMap);
		});
		console.log('✅ Status updated successfully');
	}
	
	return success;
}

// Function to start periodic status checking for a user
export function startStatusPolling(userId: string, intervalMs: number = 30000): () => void {
	console.log('⏰ Starting status polling for user:', userId, 'interval:', intervalMs);
	
	// Initial fetch
	fetchUserStatus(userId);

	// Set up polling
	const interval = setInterval(() => {
		console.log('🔄 Polling status for user:', userId);
		fetchUserStatus(userId, false); // Don't force refresh on polls
	}, intervalMs);

	// Return cleanup function
	return () => {
		console.log('🛑 Stopping status polling for user:', userId);
		clearInterval(interval);
	};
}

// Function to clear expired cache entries
export function clearExpiredStatusCache(): void {
	const now = Date.now();
	userStatusStore.update(statusMap => {
		for (const [userId, statusInfo] of statusMap.entries()) {
			if (now - statusInfo.lastUpdated > STATUS_CACHE_DURATION * 2) {
				statusMap.delete(userId);
				console.log('🗑️ Removed expired status cache for user:', userId);
			}
		}
		return new Map(statusMap);
	});
}

// Function to manually refresh a user's status
export async function refreshUserStatus(userId: string): Promise<UserStatusInfo | null> {
	console.log('🔄 Force refreshing status for user:', userId);
	return fetchUserStatus(userId, true);
}

// Function to clear all status data
export function clearAllStatusData(): void {
	console.log('🗑️ Clearing all status data');
	userStatusStore.set(new Map());
}

// Debug function to log store contents
export function debugStatusStore(): void {
	userStatusStore.subscribe(statusMap => {
		console.log('🐛 Status Store Debug:');
		console.log('📊 Store size:', statusMap.size);
		console.log('👥 Users in store:', Array.from(statusMap.keys()));
		console.log('📋 Full store contents:', Array.from(statusMap.entries()));
	})();
}