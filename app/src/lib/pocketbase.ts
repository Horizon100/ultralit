import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import type { AuthModel } from 'pocketbase';
import type { User } from '$lib/types/types';
import {
	isSuccess,
	isFailure,
	storageTryCatch,
	clientTryCatch,
	fetchTryCatch,
	rateLimitTryCatch,
	fileTryCatch
} from '$lib/utils/errorUtils';
import { pocketbaseUrl } from '$lib/stores/pocketbase';

interface RequestInitCustom {
	method?: string;
	headers?: Record<string, string>;
	body?: string | FormData;
	credentials?: 'include' | 'omit' | 'same-origin';
}
type UserProfileResponse = {
	user: Partial<User>;
	profile: unknown; // Use unknown instead of any
	posts: unknown[]; // Use unknown[] instead of any[]
	totalPosts: number;
};

// Define the wrapped response type from apiTryCatch
type ApiResponse<T> = {
	data: T;
	success: boolean;
	error?: string;
};
let authCheckInProgress: Promise<boolean> | null = null;
const userCache = new Map<string, { data: User; timestamp: number }>();
const CACHE_DURATION = 60000;
let lastAuthCheck = 0;
const AUTH_CHECK_COOLDOWN = 5000;
let cachedAuthState: { isValid: boolean; user: User; timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 60000; // 1 minute cache


// Client-side user store
export const currentUser = writable<User | null>(null);

// Initialize from localStorage if available
if (typeof window !== 'undefined') {
	try {
		const storedUser = localStorage.getItem('currentUser');
		if (storedUser) {
			currentUser.set(JSON.parse(storedUser));
		}
	} catch (e) {
		console.error('Error loading stored user data:', e);
	}
}

// Subscribe to changes and update localStorage
currentUser.subscribe((user) => {
	if (typeof window !== 'undefined') {
		if (user) {
			localStorage.setItem('currentUser', JSON.stringify(user));
		} else {
			localStorage.removeItem('currentUser');
		}
	}
});

// ============= Authentication API Calls =============

export async function checkPocketBaseConnection(): Promise<boolean> {
	console.log('Checking PocketBase connection at: /api/verify/health');

	const result = await fetchTryCatch<{ success: boolean }>(
		'/api/verify/health',
		{},
		10000 // 10 second timeout
	);

	if (isSuccess(result)) {
		return result.data.success;
	}

	// Error is already logged by fetchTryCatch
	return false;
}

export function getFileUrl(
	record: { id: string },
	filename: string,
	collection: string = 'ai_agents'
): string {
	if (!filename) return '';
	return `${pocketbaseUrl}/api/files/${collection}/${record.id}/${filename}`;
}

export async function ensureAuthenticated(): Promise<boolean> {
	// If there's already an auth check in progress, return that promise
	if (authCheckInProgress) {
		return authCheckInProgress;
	}

	const now = Date.now();
	const currentUserValue = get(currentUser);

	// Check cached auth state first
	if (
		cachedAuthState &&
		now - cachedAuthState.timestamp < AUTH_CACHE_DURATION &&
		cachedAuthState.isValid
	) {
		if (!currentUserValue || currentUserValue.id !== cachedAuthState.user.id) {
			currentUser.set(cachedAuthState.user);
		}
		return true;
	}

	// Check if we've recently validated and have a user
	if (now - lastAuthCheck < AUTH_CHECK_COOLDOWN && currentUserValue && currentUserValue.id) {
		return true;
	}

	lastAuthCheck = now;

	// Start a new authentication check
	authCheckInProgress = (async () => {
		const authResult = await fetchTryCatch<ApiResponse<{ success: boolean; user?: User }>>(
			'/api/verify/auth-check',
			{
				method: 'GET',
				credentials: 'include',
				headers: {
					Accept: 'application/json',
					'Cache-Control': 'no-cache'
				}
			},
			15000 // 15 second timeout
		);

		// Handle successful fetch
		if (isSuccess(authResult)) {
			const wrappedResponse = authResult.data;

			// The response is wrapped by apiTryCatch, so we need to access the nested data
			if (wrappedResponse.success && wrappedResponse.data) {
				const actualData = wrappedResponse.data;

				if (actualData.success && actualData.user) {
					console.log('Authentication confirmed by server');

					// Update cache
					cachedAuthState = {
						isValid: true,
						user: actualData.user,
						timestamp: now
					};

					currentUser.set(actualData.user);
					authCheckInProgress = null;
					return true;
				}

				// Server responded but auth failed
				console.warn('Authentication check failed: no user data or success=false', actualData);
				cachedAuthState = null;
				currentUser.set(null);
				authCheckInProgress = null;
				return false;
			}

			// Wrapped response failed
			console.warn('Authentication check failed: wrapped response invalid', wrappedResponse);
			cachedAuthState = null;
			currentUser.set(null);
			authCheckInProgress = null;
			return false;
		}

		// Handle fetch errors
		const error = authResult.error;
		console.error('Auth check failed:', error);

		// Check if it's a timeout error (preserve existing behavior)
		if (error.includes('timed out')) {
			console.warn('Auth check timed out - server may be slow');
			// Don't clear cache on timeout - user might still be valid
		} else {
			// Clear cache for other errors
			cachedAuthState = null;
			currentUser.set(null);
		}

		authCheckInProgress = null;
		return false;
	})();

	return authCheckInProgress;
}
export async function updateUserStatus(
	userId: string,
	status: 'online' | 'offline'
): Promise<boolean> {
	const updateResult = await clientTryCatch(
		(async () => {
			const url = `/api/users/${userId}`;
			console.log('🔍 Calling user update API:', url, 'status:', status);

			const response = await fetch(url, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					status,
					last_login: new Date().toISOString()
				}),
				credentials: 'include'
			});

			if (!response.ok) {
				console.error('Status update failed:', response.status, response.statusText);
				throw new Error(`Update failed with status: ${response.status}`);
			}

			const data = await response.json();
			console.log('📥 Status update response:', data);

			if (!data.success) {
				throw new Error(data.error || 'Unknown error during status update');
			}

			return data.user;
		})(),
		'Update user status'
	);

	if (!updateResult.success) {
		console.error('Status update error:', updateResult.error);
		return false;
	}

	const updatedUser = updateResult.data;

	// Update current user if it's the same user
	const currentUserValue = get(currentUser);
	if (currentUserValue && userId === currentUserValue.id) {
		currentUser.update((user) => {
			if (!user) return user;
			return {
				...user,
				status: updatedUser.status,
				last_login: updatedUser.last_login
			};
		});

		// Update auth cache
		if (cachedAuthState && cachedAuthState.user) {
			cachedAuthState.user = {
				...cachedAuthState.user,
				status: updatedUser.status,
				last_login: updatedUser.last_login
			};
		}
	}

	return true;
}
// Alternative approach: Use clientTryCatch instead for cleaner handling
export async function ensureAuthenticatedV2(): Promise<boolean> {
	// If there's already an auth check in progress, return that promise
	if (authCheckInProgress) {
		return authCheckInProgress;
	}

	const now = Date.now();
	const currentUserValue = get(currentUser);

	// Check cached auth state first
	if (
		cachedAuthState &&
		now - cachedAuthState.timestamp < AUTH_CACHE_DURATION &&
		cachedAuthState.isValid
	) {
		if (!currentUserValue || currentUserValue.id !== cachedAuthState.user.id) {
			currentUser.set(cachedAuthState.user);
		}
		return true;
	}

	// Check if we've recently validated and have a user
	if (now - lastAuthCheck < AUTH_CHECK_COOLDOWN && currentUserValue && currentUserValue.id) {
		return true;
	}

	lastAuthCheck = now;

	// Start a new authentication check using clientTryCatch for cleaner error handling
	authCheckInProgress = (async () => {
		const authResult = await clientTryCatch(
			fetch('/api/verify/auth-check', {
				method: 'GET',
				credentials: 'include',
				headers: {
					Accept: 'application/json',
					'Cache-Control': 'no-cache'
				}
			}).then(async (response) => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				return response.json();
			}),
			'Authentication check failed'
		);

		// Handle successful fetch with clientTryCatch
		if (isSuccess(authResult)) {
			const wrappedResponse = authResult.data as ApiResponse<{ success: boolean; user?: User }>;

			// Handle the apiTryCatch wrapped response
			if (wrappedResponse.success && wrappedResponse.data) {
				const actualData = wrappedResponse.data;

				if (actualData.success && actualData.user) {
					console.log('Authentication confirmed by server');

					// Update cache
					cachedAuthState = {
						isValid: true,
						user: actualData.user,
						timestamp: now
					};

					currentUser.set(actualData.user);
					authCheckInProgress = null;
					return true;
				}
			}

			// Auth failed
			console.warn('Authentication check failed:', wrappedResponse);
			cachedAuthState = null;
			currentUser.set(null);
			authCheckInProgress = null;
			return false;
		}

		// Handle clientTryCatch errors
		console.error('Auth check failed:', authResult.error);

		// Check if it's a timeout error
		if (authResult.error.includes('timed out')) {
			console.warn('Auth check timed out - server may be slow');
			// Don't clear cache on timeout
		} else {
			// Clear cache for other errors
			cachedAuthState = null;
			currentUser.set(null);
		}

		authCheckInProgress = null;
		return false;
	})();

	return authCheckInProgress;
}

// Helper function to fetch fresh user data (also needs to handle wrapped responses)
async function fetchFreshUserData(userId: string): Promise<User> {
	const response = await fetch(`/api/users/${userId}`, {
		method: 'GET',
		credentials: 'include',
		headers: {
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user data: ${response.status}`);
	}

	const wrappedResponse = (await response.json()) as ApiResponse<User>;

	// Handle apiTryCatch wrapped response
	if (wrappedResponse.success && wrappedResponse.data) {
		return wrappedResponse.data;
	}

	throw new Error(wrappedResponse.error || 'Failed to fetch user data');
}

// Updated refresh function
export async function refreshCurrentUser(): Promise<void> {
	const user = get(currentUser);
	if (!user?.id) return;

	const result = await clientTryCatch(fetchFreshUserData(user.id), 'refresh current user');

	if (isSuccess(result)) {
		currentUser.set(result.data);
		console.log('currentUser store updated with fresh data');
	} else {
		console.error('Failed to refresh user:', result.error);
	}
}

// Updated user field update function
export async function updateCurrentUserField(
	field: keyof User,
	value: User[keyof User]
): Promise<void> {
	const user = get(currentUser);
	if (!user?.id) return;

	// Update the store immediately for UI responsiveness
	currentUser.update((u) => (u ? { ...u, [field]: value } : null));

	// Then refresh from database to ensure consistency
	const result = await clientTryCatch(
		fetchFreshUserData(user.id),
		`update user field ${String(field)}`
	);

	if (isSuccess(result)) {
		currentUser.set(result.data);
	} else {
		console.warn(`Failed to sync field update for ${String(field)}, keeping optimistic update`);
	}
}
export async function withAuth<T>(fn: () => Promise<T>): Promise<T | null> {
	const isAuthenticated = await ensureAuthenticated();
	if (!isAuthenticated) return null;
	return fn();
}

// Clear cache on logout
export function clearAuthCache(): void {
	cachedAuthState = null;
	lastAuthCheck = 0;
	authCheckInProgress = null;
}

export async function signIn(
	email: string,
	password: string,
	retryCount: number = 0
): Promise<AuthModel | null> {
	const MAX_RETRIES = 2;
	const RETRY_DELAY = 1000;

	console.log(`Signing in (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

	const result = await fetchTryCatch<{
		success: boolean;
		user?: User;
		token?: string;
		error?: string;
	}>(
		'/api/verify/signin',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
			credentials: 'include'
		},
		20000 // 20 second timeout
	);

	if (isSuccess(result)) {
		const data = result.data;

		if (!data.success) {
			throw new Error(data.error || 'Unknown error');
		}
		if (!data.user) {
			throw new Error('Authentication failed: no user data received');
		}

		if (!data.token) {
			throw new Error('Authentication failed: no token received');
		}
		// Clear auth cache and set new user
		clearAuthCache();
		currentUser.set(data.user);
		await updateUserStatus(data.user.id, 'online');

		console.log('Sign-in successful');
		return {
			token: data.token,
			record: data.user
		};
	}

	// Handle timeout with retry logic
	if (result.error.includes('timed out') && retryCount < MAX_RETRIES) {
		console.log(`Retrying sign-in in ${RETRY_DELAY}ms...`);
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
		return signIn(email, password, retryCount + 1);
	}

	// Handle final timeout or other errors
	if (result.error.includes('timed out')) {
		throw new Error(
			'Sign-in request timed out after multiple attempts. Please check your connection and try again.'
		);
	}

	// Re-throw other errors
	throw new Error(result.error);
}

export async function signUp(email: string, password: string): Promise<User | null> {
	console.log('Signing up user...');

	const result = await fetchTryCatch<{ success: boolean; user?: User; error?: string }>(
		'/api/verify/signup',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		},
		10000 // 10 second timeout
	);

	if (isSuccess(result)) {
		const data = result.data;

		if (!data.success) {
			throw new Error(data.error || 'Unknown error during sign-up');
		}
		if (!data.user) {
			throw new Error('Sign-up failed: no user data received');
		}
		// Clear auth cache and set new user
		clearAuthCache();
		currentUser.set(data.user);
		return data.user;
	}

	// Log error and return null (matching original behavior)
	console.error('Sign-up error:', result.error);
	return null;
}

export async function signOut(): Promise<void> {
	console.log('Signing out...');

	// Call server to clear server-side auth (don't throw on failure)
	const result = await fetchTryCatch(
		'/api/verify/signout',
		{
			method: 'POST',
			credentials: 'include'
		},
		5000 // 5 second timeout
	);

	if (!isSuccess(result)) {
		if (result.error.includes('timed out')) {
			console.warn('Sign-out request timed out, but clearing local data anyway');
		} else {
			console.error('Sign-out error:', result.error);
		}
	}

	// Always clear local data (even if server request failed)
	clearAuthCache();
	const currentUserValue = get(currentUser);
	const userId = currentUserValue?.id;

	currentUser.set(null);

	if (userId) {
		await updateUserStatus(userId, 'offline');
	}

	// Clear stored auth data safely
	storageTryCatch(
		() => {
			if (typeof window !== 'undefined') {
				localStorage.removeItem('pocketbase_auth');
				localStorage.removeItem('currentUser');
			}
		},
		undefined,
		'Error clearing localStorage during signout'
	);

	console.log('Sign-out completed successfully');
}

export async function updateUser(id: string, userData: FormData | Partial<User>): Promise<User> {
	console.log('Updating user at:', `/api/verify/users/${id}`);

	const isFormData = userData instanceof FormData;
	const timeout = isFormData ? 30000 : 10000; // 30s for files, 10s for JSON

	const fetchOptions: RequestInitCustom = {
		method: 'PATCH',
		credentials: 'include',
		...(isFormData
			? { body: userData }
			: {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(userData)
				})
	};

	const result = await fetchTryCatch<{ success: boolean; user: User; error?: string }>(
		`/api/verify/users/${id}`,
		fetchOptions,
		timeout
	);

	if (!isSuccess(result)) {
		if (result.error.includes('timed out')) {
			throw new Error('Update request timed out. Please try again.');
		}
		throw new Error(result.error);
	}

	const data = result.data;
	console.log('🔍 Full API response:', data);
	console.log('🔍 data.user:', data.user);
	console.log('🔍 data.success:', data.success);
	if (!data.success) {
		throw new Error(data.error || 'Unknown error');
	}

	// Update the current user if it's the same user
	if (id === data.user.id) {
		// If this was an avatar update, make sure avatarUrl is set
		if (isFormData && userData.has('avatar')) {
			if (data.user.avatar) {
				data.user.avatarUrl = `${pocketbaseUrl}/api/files/${data.user.collectionId || 'users'}/${data.user.id}/${data.user.avatar}`;
			}
		}

		currentUser.set(data.user);
		// Update auth cache
		if (cachedAuthState) {
			cachedAuthState.user = data.user;
		}
	}

	return data.user;
}

export async function getUserById(
	userId: string,
	bypassCache: boolean = false
): Promise<User | null> {
	console.log('getUserById: Starting with userId:', userId, 'bypassCache:', bypassCache);

	const now = Date.now();
	const cachedUser = userCache.get(userId);
	if (!bypassCache && cachedUser && now - cachedUser.timestamp < CACHE_DURATION) {
		console.log('getUserById: Returning cached user');
		return cachedUser.data;
	}

	console.log('getUserById: Making API request to /api/verify/users/' + userId + '/public');

	const result = await fetchTryCatch<{
		success: boolean;
		user?: User;
		data?: User;
		error?: string;
	}>(
		`/api/verify/users/${userId}/public`,
		{
			method: 'GET',
			credentials: 'include'
		},
		10000
	);

	if (!isSuccess(result)) {
		console.error('getUserById: fetchTryCatch failed:', result.error);
		return null;
	}

	const data = result.data;
	console.log('getUserById: Raw API response:', data);

	if (!data.success) {
		console.error('getUserById: API returned success=false:', data.error);
		return null;
	}

	// Try different possible response structures
	let userData: User | null = null;

	if (data.user) {
		console.log('getUserById: Found user data in data.user');
		userData = data.user;
	} else if (data.data) {
		console.log('getUserById: Found user data in data.data');
		userData = data.data;
	} else {
		// Maybe the user data is directly in the response (excluding success field)
		const { success: _, error: __, ...possibleUserData } = data;
		if (Object.keys(possibleUserData).length > 0) {
			console.log('getUserById: Found user data in root level');
			userData = possibleUserData as User;
		}
	}

	if (!userData) {
		console.error('getUserById: No user data found in response structure');
		return null;
	}

	console.log('getUserById: Successfully extracted user data:', userData);
	userCache.set(userId, { data: userData, timestamp: now });
	return userData;
}

const pendingRequests = new Map<string, Promise<Partial<User>[]>>();

export async function getPublicUsersBatch(userIds: string[]): Promise<Partial<User>[]> {
	if (!userIds || userIds.length === 0) {
		console.log('No user IDs provided to getPublicUsersBatch');
		return [];
	}

	const uniqueUserIds = [...new Set(userIds)].filter(
		(id) => id && typeof id === 'string' && id.trim().length > 0
	);

	if (uniqueUserIds.length === 0) {
		console.log('No valid user IDs after filtering');
		return [];
	}

	const cacheKey = uniqueUserIds.sort().join(',');

	if (pendingRequests.has(cacheKey)) {
		console.log(`Request for ${uniqueUserIds.length} users already pending, waiting...`);
		const existingRequest = pendingRequests.get(cacheKey);
		return existingRequest ? await existingRequest : [];
	}

	const requestPromise = executeUserBatchRequest(uniqueUserIds);
	pendingRequests.set(cacheKey, requestPromise);

	try {
		const result = await requestPromise;
		return result;
	} finally {
		pendingRequests.delete(cacheKey);
	}
}

async function executeUserBatchRequest(userIds: string[]): Promise<Partial<User>[]> {
	const url = `/api/users/public/batch`;

	console.log(`Getting batch user data for ${userIds.length} users:`, userIds);

	const user = get(currentUser);

	const result = await rateLimitTryCatch(
		fetchTryCatch<{
			success: boolean;
			users: Partial<User>[];
			meta?: { cached?: boolean; responseTime?: number };
			error?: string;
			message?: string;
		}>(
			url,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(user?.token && {
						Authorization: `Bearer ${user.token}`
					})
				},
				credentials: 'include',
				body: JSON.stringify({ userIds })
			},
			15000 // 15 second timeout
		).then((fetchResult) => {
			if (!isSuccess(fetchResult)) {
				throw new Error(fetchResult.error);
			}

			const data = fetchResult.data;

			if (!data.success) {
				console.error('API returned error:', data.error, data.message);
				return { success: false, users: new Array(userIds.length).fill(null), meta: null };
			}

			const profiles = data.users || [];

			if (data.meta?.cached) {
				console.log(
					`Retrieved ${profiles.length} cached user profiles in ${data.meta.responseTime || 'unknown'}ms`
				);
			} else {
				console.log(
					`Retrieved ${profiles.length} user profiles from database in ${data.meta?.responseTime || 'unknown'}ms`
				);
			}

			if (profiles.length !== userIds.length) {
				console.warn(`Expected ${userIds.length} profiles, got ${profiles.length}`);
			}

			return { success: true, users: profiles, meta: data.meta };
		})
	);

	if (isFailure(result)) {
		console.error('Error fetching batch user data:', result.error);
		return new Array(userIds.length).fill(null);
	}

	return result.data.users;
}

export function clearPendingUserRequests(): void {
	pendingRequests.clear();
}

export async function getPublicUserByUsername(username: string): Promise<Partial<User> | null> {
	console.log('Getting user by username at:', `/api/users/username/${username}`);

	const result = await fetchTryCatch<UserProfileResponse | ApiResponse<UserProfileResponse>>(
		`/api/users/username/${username}`,
		{},
		10000
	);

	if (!isSuccess(result)) {
		console.error('Get user by username failed:', result.error);
		return null;
	}

	const data = result.data;

	// Type-safe way to handle the potential wrapper
	let actualData: UserProfileResponse;

	if ('data' in data && typeof data.data === 'object' && data.data !== null) {
		// It's wrapped by apiTryCatch
		actualData = data.data as UserProfileResponse;
	} else {
		// It's not wrapped
		actualData = data as UserProfileResponse;
	}

	if (!actualData || !actualData.user) {
		console.error('User not found in response:', actualData);
		return null;
	}

	return actualData.user;
}

export async function getPublicUserData(userId: string): Promise<Partial<User> | null> {
	console.log('Getting public user data at:', `/api/verify/users/${userId}/public`);

	const result = await fetchTryCatch<{ success: boolean; user: Partial<User>; error?: string }>(
		`/api/verify/users/${userId}/public`,
		{},
		10000
	);

	if (!isSuccess(result)) {
		console.error('Get public user data failed:', result.error);
		return null;
	}

	const data = result.data;
	if (!data.success) {
		console.error('Get public user data API error:', data.error);
		return null;
	}

	return data.user;
}

export async function getUserCount(): Promise<number> {
	console.log('Getting user count at: /api/verify/users/count');

	const result = await fetchTryCatch<{ success: boolean; count: number }>(
		'/api/verify/users/count',
		{},
		10000
	);

	if (!isSuccess(result)) {
		console.error('Get user count failed:', result.error);
		return 0;
	}

	const data = result.data;
	return data.success ? data.count : 0;
}

export async function authenticateWithGoogleOAuth() {
	try {
		console.log('Starting Google OAuth...');

		// Use your API endpoint instead of creating new PocketBase instance
		const result = await fetchTryCatch<{ success: boolean; user: User; token: string }>(
			'/api/auth/oauth/google',
			{
				method: 'POST',
				credentials: 'include'
			}
		);

		if (isSuccess(result) && result.data.success) {
			const user = result.data.user;
			clearAuthCache();
			currentUser.set(user);
			return { record: user, token: result.data.token };
		}

		throw new Error('OAuth authentication failed');
	} catch (error) {
		console.error('Google authentication error:', error);
		throw error;
	}
}

export async function uploadAvatar(userId: string, file: File): Promise<User | null> {
	try {
		const formData = new FormData();
		formData.append('avatar', file);

		const url = `/api/verify/users/${userId}`;
		const response = await fetch(url, {
			method: 'PATCH',
			body: formData,
			credentials: 'include',
			signal: AbortSignal.timeout(30000)
		});

		if (!response.ok) {
			console.error('Avatar upload failed:', response.status, response.statusText);
			throw new Error(`Upload failed with status: ${response.status}`);
		}

		const data = await response.json();
		console.log('Upload response:', data);
		
		if (!data.success) {
			throw new Error(data.error || 'Unknown error during upload');
		}

		// Upload succeeded! Don't worry about parsing complex user data
		// Just return a minimal success object and let the UI refresh separately
		console.log('Avatar upload successful!');
		return { id: userId, uploadSuccess: true } as any;
		
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error('Avatar upload timed out. Please try again.');
		}
		console.error('Avatar upload error:', error);
		return null;
	}
}
// Add these functions to your lib/pocketbase.ts file

export async function uploadProfileWallpaper(userId: string, file: File): Promise<User | null> {
	const uploadResult = await fileTryCatch(
		(async () => {
			const formData = new FormData();
			formData.append('profileWallpaper', file); // This field is already handled in your verify endpoint

			const url = `/api/verify/users/${userId}`; // Use the existing verify endpoint
			const response = await fetch(url, {
				method: 'PATCH',
				body: formData,
				credentials: 'include',
				signal: AbortSignal.timeout(30000)
			});

			if (!response.ok) {
				console.error('Wallpaper upload failed:', response.status, response.statusText);
				throw new Error(`Upload failed with status: ${response.status}`);
			}

			const data = await response.json();
			console.log('🔍 Description API response:', data);

			if (!data.success) throw new Error(data.error || 'Unknown error during upload');

			return data.user || data.data || { id: userId, profileWallpaper: 'uploaded' };
		})(),
		file.name,
		5
	);

	if (!uploadResult.success) {
		console.error('Wallpaper upload error:', uploadResult.error);
		throw new Error(uploadResult.error);
	}

	const updatedUser = uploadResult.data;

	if (!updatedUser) {
		console.warn('No user data returned, but upload may have succeeded');
		return null;
	}
	// Update current user if it's the same user
	if (userId === updatedUser.id) {
		currentUser.update((user) => {
			if (!user) return user;
			return {
				...user,
				profileWallpaper: updatedUser?.profileWallpaper || 'uploaded'
			};
		});

		if (cachedAuthState) {
			cachedAuthState.user = {
				...cachedAuthState.user,
				profileWallpaper: updatedUser?.profileWallpaper || 'uploaded'
			};
		}
	}

	return updatedUser;
}

export async function updateUserDescription(userId: string, description: string): Promise<boolean> {
	const updateResult = await clientTryCatch(
		(async () => {
			const url = `/api/users/${userId}/description`;
			const response = await fetch(url, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ description }),
				credentials: 'include'
			});

			if (!response.ok) {
				console.error('Description update failed:', response.status, response.statusText);
				throw new Error(`Update failed with status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Unknown error during update');
			}

			return data.user || data.data || { id: userId, description: description };
		})(),
		'Update user description'
	);

	if (!updateResult.success) {
		console.error('Description update error:', updateResult.error);
		return false;
	}

	const updatedUser = updateResult.data;

	// Update current user if it's the same user
	const currentUserValue = get(currentUser);
	if (currentUserValue && userId === currentUserValue.id) {
		currentUser.update((user) => {
			if (!user) return user;
			return {
				...user,
				description: updatedUser.description
			};
		});

		// Update auth cache
		if (cachedAuthState && cachedAuthState.user) {
			cachedAuthState.user = {
				...cachedAuthState.user,
				description: updatedUser.description
			};
		}
	}

	return true;
}

/**
 * Request a password reset email for the specified user
 * @param email The email address of the user requesting a password reset
 * @returns A boolean indicating whether the request was successful
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
	console.log('Requesting password reset for email:', email);

	const result = await fetchTryCatch<{ success: boolean; error?: string }>(
		'/api/auth/reset-password',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		},
		10000 // 10 second timeout
	);

	if (!isSuccess(result)) {
		console.error('Password reset request failed:', result.error);
		throw new Error(result.error);
	}

	const data = result.data;
	console.log('Password reset response data:', data);

	if (!data.success && data.error) {
		throw new Error(data.error);
	}

	return data.success;
}
export function unsubscribeFromChanges(unsubscribe: () => void): void {
	unsubscribe();
}
