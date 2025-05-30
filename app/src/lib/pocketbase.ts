import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import type { AuthModel } from 'pocketbase';
import PocketBase from 'pocketbase';
import type {
	User,
	AIAgent,
	Network,
	Task,
	AIPreferences,
	Message,
	NetworkData,
	AIModel,
	Threads,
	Messages
} from '$lib/types/types';

let authCheckInProgress: Promise<boolean> | null = null;
const userCache = new Map<string, { data: User; timestamp: number }>();
const CACHE_DURATION = 60000;
let lastAuthCheck = 0;
const AUTH_CHECK_COOLDOWN = 5000;
let cachedAuthState: { isValid: boolean; user: User; timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 60000; // 1 minute cache



// Export PocketBase URL for UI components (avatar display, etc.)
export const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;

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
export async function refreshCurrentUser(): Promise<void> {
	const user = get(currentUser);
	if (!user?.id) return;

	try {
		console.log('Refreshing current user data from database...');
		
		const pb = new PocketBase(pocketbaseUrl);
		
		if (typeof window !== 'undefined') {
			const authData = localStorage.getItem('pocketbase_auth');
			if (authData) {
				pb.authStore.loadFromCookie(authData);
			}
		}

		const freshUser = await pb.collection('users').getOne(user.id, {
			fields: '*' 
		});

		console.log('Fresh user data from database:', freshUser);
		
		currentUser.set(freshUser as User);
		
		console.log('currentUser store updated with fresh data');
		
	} catch (error) {
		console.error('Failed to refresh current user:', error);
	}
}

// Function to update a specific field in the current user
export async function updateCurrentUserField(field: keyof User, value: User[keyof User]): Promise<void> {
	const user = get(currentUser);
	if (!user?.id) return;

	try {
		// Update the store immediately for UI responsiveness
		currentUser.update(u => u ? { ...u, [field]: value } : null);
		
		// Then refresh from database to ensure consistency
		await refreshCurrentUser();
		
	} catch (error) {
		console.error(`Failed to update user field ${field}:`, error);
		// Refresh anyway to get the current state
		await refreshCurrentUser();
	}
}
// ============= Authentication API Calls =============

export async function checkPocketBaseConnection(): Promise<boolean> {
	try {
		// Log the full URL we're trying to fetch
		const url = '/api/verify/health';
		console.log('Checking PocketBase connection at:', url);

		const response = await fetch(url);

		// Check if response is ok
		if (!response.ok) {
			console.error('PocketBase health check failed:', response.status, response.statusText);
			return false;
		}

		const contentType = response.headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			console.error('Unexpected content type:', contentType);
			return false;
		}

		const data = await response.json();
		return data.success;
	} catch (error) {
		console.error('PocketBase connection error:', error);
		return false;
	}
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
	if (cachedAuthState && 
		now - cachedAuthState.timestamp < AUTH_CACHE_DURATION && 
		cachedAuthState.isValid) {
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
		try {
			const url = '/api/verify/auth-check';
			console.log('Checking authentication with server...');

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for auth check

			const response = await fetch(url, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Accept': 'application/json',
					'Cache-Control': 'no-cache' // Prevent browser caching
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				console.warn('Authentication check failed: server returned', response.status);
				cachedAuthState = null;
				currentUser.set(null);
				return false;
			}

			const data = await response.json();
			if (data.success && data.user) {
				console.log('Authentication confirmed by server');
				
				// Update cache
				cachedAuthState = {
					isValid: true,
					user: data.user,
					timestamp: now
				};
				
				currentUser.set(data.user);
				return true;
			}

			console.warn('Authentication check failed: invalid user data', data);
			cachedAuthState = null;
			currentUser.set(null);
			return false;
		} catch (error) {
			console.error('Auth check error:', error);
			cachedAuthState = null;
			currentUser.set(null);
			return false;
		} finally {
			authCheckInProgress = null;
		}
	})();

	return authCheckInProgress;
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
export async function signIn(email: string, password: string): Promise<AuthModel | null> {
	try {
		const url = '/api/verify/signin';
		console.log('Signing in at:', url);

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
			credentials: 'include'
		});

		if (!response.ok) {
			console.error('Sign-in failed:', response.status, response.statusText);

			// Try to get error message from response
			const errorData = await response.json().catch(() => null);
			if (errorData && errorData.error) {
				throw new Error(errorData.error);
			}

			throw new Error(`Sign-in failed with status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error || 'Unknown error');

		currentUser.set(data.user);

		return {
			token: data.token,
			record: data.user
		};	
	} catch (error) {
		console.error('Sign-in error:', error instanceof Error ? error.message : String(error));
		return null;
	}
}

export async function signUp(email: string, password: string): Promise<User | null> {
	try {
		// Log the full URL we're trying to fetch (like in your signIn function)
		const url = '/api/verify/signup';
		console.log('Signing up at:', url);

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});

		// Check if response is ok
		if (!response.ok) {
			console.error('Sign-up failed:', response.status, response.statusText);

			// Try to get error message from response
			const errorData = await response.json().catch(() => null);
			if (errorData && errorData.error) {
				throw new Error(errorData.error);
			}

			throw new Error(`Sign-up failed with status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error || 'Unknown error during sign-up');

		currentUser.set(data.user);
		return data.user;
	} catch (error) {
		console.error('Sign-up error:', error instanceof Error ? error.message : String(error));
		// Return null instead of rethrowing, just like in signIn
		return null;
	}
}


export async function signOut(): Promise<void> {
	try {
		// Clear client-side PocketBase auth store
		const pb = new PocketBase(pocketbaseUrl);
		pb.authStore.clear();

		// Log the full URL we're trying to fetch
		const url = '/api/verify/signout';
		console.log('Signing out at:', url);

		// Call server to clear server-side auth
		await fetch(url, {
			method: 'POST',
			credentials: 'include'
		});

		// Clear client-side user store
		currentUser.set(null);

		// Clear any stored auth data in localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem('pocketbase_auth');
			localStorage.removeItem('currentUser');
		}

		console.log('Sign-out completed successfully');
	} catch (error) {
		console.error('Sign-out error:', error);
	}
}

/*
 * export async function updateUser(id: string, userData: FormData | Partial<User>): Promise<User> {
 * 	try {
 * 		const url = `/api/verify/users/${id}`;
 * 		console.log('Updating user at:', url);
 */

// 		let response;

/*
 * 		if (userData instanceof FormData) {
 * 			response = await fetch(url, {
 * 				method: 'PATCH',
 * 				body: userData,
 * 				credentials: 'include'
 * 			});
 * 		} else {
 * 			response = await fetch(url, {
 * 				method: 'PATCH',
 * 				headers: { 'Content-Type': 'application/json' },
 * 				body: JSON.stringify(userData),
 * 				credentials: 'include'
 * 			});
 * 		}
 */

/*
 * 		if (!response.ok) {
 * 			console.error('Update user failed:', response.status, response.statusText);
 */

/*
 * 			const errorData = await response.json().catch(() => null);
 * 			if (errorData && errorData.error) {
 * 				throw new Error(errorData.error);
 * 			}
 */

/*
 * 			throw new Error(`Update user failed with status: ${response.status}`);
 * 		}
 */

/*
 * 		const data = await response.json();
 * 		if (!data.success) throw new Error(data.error);
 */

/*
 * 		// Update the current user if it's the same user
 * 		if (id === data.user.id) {
 * 			currentUser.set(data.user);
 * 		}
 */

/*
 * 		return data.user;
 * 	} catch (error) {
 * 		console.error('Update user error:', error);
 * 		throw error;
 * 	}
 * }
 */
export async function updateUser(id: string, userData: FormData | Partial<User>): Promise<User> {
	try {
		// Log the full URL we're trying to fetch
		const url = `/api/verify/users/${id}`;
		console.log('Updating user at:', url);

		// Handle both FormData and JSON data
		let response;

		if (userData instanceof FormData) {
			response = await fetch(url, {
				method: 'PATCH',
				body: userData,
				credentials: 'include'
				// IMPORTANT: Do NOT set Content-Type header for FormData
			});
		} else {
			response = await fetch(url, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(userData),
				credentials: 'include'
			});
		}

		// Check if response is ok
		if (!response.ok) {
			console.error('Update user failed:', response.status, response.statusText);

			// Try to get error message from response
			try {
				const errorData = await response.json();
				if (errorData && errorData.error) {
					throw new Error(errorData.error);
				}
			} catch {
				// If response is not JSON or fails to parse
				throw new Error(`Update user failed with status: ${response.status}`);
			}

			throw new Error(`Update user failed with status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error || 'Unknown error');

		// Update the current user if it's the same user
		if (id === data.user.id) {
			// If this was an avatar update, make sure avatarUrl is set
			if (userData instanceof FormData && userData.has('avatar')) {
				// Set avatarUrl directly
				if (data.user.avatar) {
					data.user.avatarUrl = `${pocketbaseUrl}/api/files/${data.user.collectionId || 'users'}/${data.user.id}/${data.user.avatar}`;
				}
			}

			currentUser.set(data.user);
		}

		return data.user;
	} catch (error) {
		console.error('Update user error:', error);
		throw error;
	}
}

export async function getUserById(userId: string, bypassCache: boolean = false): Promise<User | null> {
	const now = Date.now();
	const cachedUser = userCache.get(userId);
	if (!bypassCache && cachedUser && now - cachedUser.timestamp < CACHE_DURATION) {
		return cachedUser.data;
	}

	try {
		const url = `/api/verify/users/${userId}/public`;

		const response = await fetch(url, {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			console.error('Get user failed:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		userCache.set(userId, { data: data.user, timestamp: now });

		return data.user;
	} catch (error) {
		console.error('Get user error:', error);
		return null;
	}
}
export async function getPublicUsersBatch(userIds: string[]): Promise<Partial<User>[]> {
	try {
		const url = `/api/users/public/batch`;
		console.log('Getting batch user data for', userIds.length, 'users');

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userIds })
		});

		if (!response.ok) {
			console.error('Batch user data failed:', response.status, response.statusText);
			return [];
		}

		const profiles = await response.json();
		return profiles;
	} catch (error) {
		console.error('Error fetching batch user data:', error);
		return [];
	}
}
export async function getPublicUserByUsername(username: string): Promise<Partial<User> | null> {
	try {
		const url = `/api/users/username/${username}`;
		console.log('Getting user by username at:', url);

		const response = await fetch(url);

		if (!response.ok) {
			console.error('Get user by username failed:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();

		if (!data.user) throw new Error('User not found');
		return data.user;
	} catch (error) {
		console.error('Error fetching user by username:', error);
		return null;
	}
}
export async function getPublicUserData(userId: string): Promise<Partial<User> | null> {
	try {
		// Log the full URL we're trying to fetch
		const url = `/api/verify/users/${userId}/public`;
		console.log('Getting public user data at:', url);

		const response = await fetch(url);

		// Check if response is ok
		if (!response.ok) {
			console.error('Get public user data failed:', response.status, response.statusText);
			return null;
		}

		const data = await response.json();

		if (!data.success) throw new Error(data.error);
		return data.user;
	} catch (error) {
		console.error('Error fetching public user data:', error);
		return null;
	}
}

export async function getUserCount(): Promise<number> {
	try {
		// Log the full URL we're trying to fetch
		const url = '/api/verify/users/count';
		console.log('Getting user count at:', url);

		const response = await fetch(url);

		// Check if response is ok
		if (!response.ok) {
			console.error('Get user count failed:', response.status, response.statusText);
			return 0;
		}

		const data = await response.json();
		return data.success ? data.count : 0;
	} catch (error) {
		console.error('Error fetching user count:', error);
		return 0;
	}
}

export async function authenticateWithGoogleOAuth() {
	try {
		console.log('Starting Google OAuth with PocketBase...');

		// Create a temporary PocketBase instance for auth only
		const authPb = new PocketBase('https://vrazum.com');

		/*
		 * Use PocketBase's built-in OAuth2 method WITHOUT specifying a redirectUrl
		 * This will use the correct PocketBase redirect URL format:
		 * http://yourdomain.com/api/oauth2-redirect
		 */
		const authData = await authPb.collection('users').authWithOAuth2({
			provider: 'google',
			// Do NOT specify redirectUrl - let PocketBase handle it
			createData: {
				// Optional: You can set default data for new users here
			}
		});

		console.log('Google OAuth completed successfully:', authData);

		// Update the current user store
		if (authData && authData.record) {
			const user = authData.record as User;
			currentUser.set(user);
			//   currentUser.set(authData.record);
		}

		return authData;
	} catch (error) {
		console.error('Google authentication error:', error);
		throw error;
	}
}

// Updated uploadAvatar function for pocketbase.ts
export async function uploadAvatar(userId: string, file: File): Promise<User | null> {
	try {
		// Create FormData to send the file
		const formData = new FormData();
		formData.append('avatar', file);

		// Make the request with FormData
		const url = `/api/verify/users/${userId}`;
		const response = await fetch(url, {
			method: 'PATCH',
			body: formData,
			credentials: 'include'
			// IMPORTANT: Do NOT set Content-Type header - browser will set it with boundary
		});

		if (!response.ok) {
			console.error('Avatar upload failed:', response.status, response.statusText);
			throw new Error(`Upload failed with status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error || 'Unknown error during upload');

		// Update user with the new avatar
		const updatedUser = data.user;

		// Update current user if it's the same user
		if (userId === updatedUser.id) {
			// Update the avatarUrl
			if (updatedUser.avatar) {
				updatedUser.avatarUrl = `${pocketbaseUrl}/api/files/${updatedUser.collectionId || 'users'}/${updatedUser.id}/${updatedUser.avatar}`;
			}

			currentUser.set(updatedUser);
		}

		return updatedUser;
	} catch (error) {
		console.error('Avatar upload error:', error);
		return null;
	}
}

/**
 * Request a password reset email for the specified user
 * @param email The email address of the user requesting a password reset
 * @returns A boolean indicating whether the request was successful
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
	try {
		// Log the full URL we're trying to fetch
		const url = '/api/auth/reset-password';
		console.log('Requesting password reset at:', url, 'for email:', email);

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email })
		});

		// Log the response status
		console.log('Password reset response status:', response.status);

		// Check if response is ok
		if (!response.ok) {
			console.error('Password reset request failed:', response.status, response.statusText);

			// Try to get error message from response
			const errorData = await response.json().catch(() => null);
			console.error('Error data:', errorData);

			if (errorData && errorData.error) {
				throw new Error(errorData.error);
			}

			throw new Error(`Password reset request failed with status: ${response.status}`);
		}

		const data = await response.json();
		console.log('Password reset response data:', data);

		return data.success;
	} catch (error) {
		console.error(
			'Password reset request error:',
			error instanceof Error ? error.message : String(error)
		);
		throw error;
	}
}
export function unsubscribeFromChanges(unsubscribe: () => void): void {
	unsubscribe();
}

// ============= AI Agent API Calls =============

export async function createAgentWithSummary(summary: string, userId: string): Promise<AIAgent> {
	try {
		const response = await fetch('/api/ai/agents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ summary, userId })
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.agent;
	} catch (error) {
		console.error('Error creating agent with summary:', error);
		throw error;
	}
}

export async function updateAIAgent(id: string, agentData: Partial<AIAgent>): Promise<AIAgent> {
	try {
		const response = await fetch(`/api/ai/agents/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(agentData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.agent;
	} catch (error) {
		console.error('Error updating AI agent:', error);
		throw error;
	}
}

export async function getAgentById(id: string): Promise<AIAgent | null> {
	try {
		const response = await fetch(`/api/ai/agents/${id}`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.agent;
	} catch (error) {
		console.error('Error fetching agent:', error);
		return null;
	}
}

export async function fetchUserAgents(userId: string): Promise<AIAgent[]> {
	try {
		const response = await fetch(`/api/ai/users/${userId}/agents`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.agents;
	} catch (error) {
		console.error('Error fetching user agents:', error);
		throw error;
	}
}

// ============= Network API Calls =============

export async function createNetwork(networkData: Partial<Network>): Promise<Network> {
	try {
		const response = await fetch('/api/network/networks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(networkData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.network;
	} catch (error) {
		console.error('Error creating network:', error);
		throw error;
	}
}

export async function updateNetwork(id: string, networkData: Partial<Network>): Promise<Network> {
	try {
		const response = await fetch(`/api/network/networks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(networkData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.network;
	} catch (error) {
		console.error('Error updating network:', error);
		throw error;
	}
}

export async function saveNetworkLayout(networkData: NetworkData): Promise<NetworkData | null> {
	try {
		const response = await fetch('/api/network/layout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(networkData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.layout;
	} catch (error) {
		console.error('Error saving network layout:', error);
		return null;
	}
}

// ============= AI Preferences API Calls =============

export async function saveAIPreferences(preferences: AIPreferences): Promise<AIPreferences> {
	try {
		const response = await fetch('/api/ai/preferences', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(preferences)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.preferences;
	} catch (error) {
		console.error('Error saving AI preferences:', error);
		throw error;
	}
}

export async function getAIPreferencesByUserId(userId: string): Promise<AIPreferences | null> {
	try {
		const response = await fetch(`/api/ai/users/${userId}/preferences`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.preferences;
	} catch (error) {
		console.error('Error fetching AI preferences:', error);
		return null;
	}
}

export async function updateAIPreferences(
	id: string,
	preferences: Partial<AIPreferences>
): Promise<AIPreferences> {
	try {
		const response = await fetch(`/api/ai/preferences/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(preferences)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.preferences;
	} catch (error) {
		console.error('Error updating AI preferences:', error);
		throw error;
	}
}

// ============= Task API Calls =============

export async function createTask(taskData: Partial<Task>): Promise<Task> {
	try {
		const response = await fetch('/api/keys/tasks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(taskData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.task;
	} catch (error) {
		console.error('Error creating task:', error);
		throw error;
	}
}

export async function saveTasksForAgent(tasks: Task[], agentId: string): Promise<Task[]> {
	try {
		const response = await fetch(`/api/keys/agents/${agentId}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ tasks })
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.tasks;
	} catch (error) {
		console.error('Error saving tasks for agent:', error);
		throw error;
	}
}

export async function updateTask(id: string, task: Partial<Task>): Promise<Task> {
	try {
		const response = await fetch(`/api/keys/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(task)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.task;
	} catch (error) {
		console.error('Error updating task:', error);
		throw error;
	}
}

export async function getTaskById(id: string): Promise<Task | null> {
	try {
		const response = await fetch(`/api/keys/tasks/${id}`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.task;
	} catch (error) {
		console.error('Error fetching task:', error);
		return null;
	}
}

// ============= Message API Calls =============

export async function getMessagesByTaskId(taskId: string): Promise<Message[]> {
	try {
		const response = await fetch(`/api/keys/tasks/${taskId}/messages`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.messages;
	} catch (error) {
		console.error('Error fetching messages:', error);
		return [];
	}
}

export async function createMessage(messageData: Partial<Message>): Promise<Message> {
	try {
		const response = await fetch('/api/keys/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(messageData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.message;
	} catch (error) {
		console.error('Error creating message:', error);
		throw error;
	}
}

export async function updateMessage(id: string, messageData: Partial<Message>): Promise<Message> {
	try {
		const response = await fetch(`/api/keys/messages/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(messageData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.message;
	} catch (error) {
		console.error('Error updating message:', error);
		throw error;
	}
}

export async function deleteMessage(id: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/keys/messages/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return true;
	} catch (error) {
		console.error('Error deleting message:', error);
		return false;
	}
}



// ============= Other User Data API Calls =============

export async function fetchUserModels(userId: string): Promise<AIModel[]> {
	try {
		const response = await fetch(`/api/ai/users/${userId}/models`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.models;
	} catch (error) {
		console.error('Error fetching user models:', error);
		return [];
	}
}

export async function fetchUserModelPreferences(
	userId: string
): Promise<{ provider: string | null; model: string | null }> {
	try {
		const response = await fetch(`/api/ai/users/${userId}/model-preferences`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.preferences;
	} catch (error) {
		console.error('Error fetching user model preferences:', error);
		return {
			provider: null,
			model: null
		};
	}
}

export async function updateUserModelPreferences(
	userId: string,
	provider: string,
	model: string
): Promise<User> {
	try {
		const response = await fetch(`/api/ai/users/${userId}/model-preferences`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ provider, model })
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.user;
	} catch (error) {
		console.error('Error updating user model preferences:', error);
		throw error;
	}
}

export function getDefaultModelPreferences() {
	return {
		provider: 'openai',
		model: 'gpt-3.5-turbo'
	};
}

export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
	try {
		const response = await fetch('/api/keys/threads', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(threadData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.thread;
	} catch (error) {
		console.error('Error creating thread:', error);
		throw error;
	}
}

export async function updateThread(id: string, threadData: Partial<Threads>): Promise<Threads> {
	try {
		const response = await fetch(`/api/keys/threads/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(threadData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.thread;
	} catch (error) {
		console.error('Error updating thread:', error);
		throw error;
	}
}

export async function deleteThread(id: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/keys/threads/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return true;
	} catch (error) {
		console.error('Error deleting thread:', error);
		return false;
	}
}

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
	try {
		const response = await fetch(`/api/keys/threads/${threadId}/messages`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.messages;
	} catch (error) {
		console.error('Error fetching messages for thread:', error);
		throw error;
	}
}

// ============= Compound/Combined Operation API Calls =============

export async function createAIAgent(agentData: Partial<AIAgent>): Promise<AIAgent> {
	try {
		const response = await fetch('/api/ai/agents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(agentData)
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.agent;
	} catch (error) {
		console.error('Error creating AI agent:', error);
		throw error;
	}
}

export async function createAgentAndTask(
	summary: string,
	userId: string,
	taskTitle: string,
	taskDescription: string
): Promise<{ agent: AIAgent; task: Task }> {
	try {
		const response = await fetch('/api/ai/agent-with-task', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ summary, userId, taskTitle, taskDescription })
		});

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.result;
	} catch (error) {
		console.error('Error creating agent and task:', error);
		throw error;
	}
}
