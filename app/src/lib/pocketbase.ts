import { writable } from 'svelte/store';
import type { AuthModel } from 'pocketbase';
import type {
	User,
	AIAgent,
	Network,
	Task,
	AIPreferences,
	Message,
	NetworkData,
	CursorPosition,
	AIModel,
	Actions,
	Workflows,
	Workspaces,
	Threads,
	Messages,
	Projects
} from '$lib/types/types';

let authCheckInProgress: Promise<boolean> | null = null;
const userCache = new Map<string, { data: User, timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache

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


export async function ensureAuthenticated(): Promise<boolean> {
    if (authCheckInProgress) {
        return authCheckInProgress;
    }

    authCheckInProgress = (async () => {
        try {
            const url = '/api/verify/auth-check';
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                currentUser.set(null);
                console.warn('Authentication check failed: server returned', response.status);
                return false;
            }

            const data = await response.json();
            if (data.success && data.user) {
                currentUser.set(data.user);
                return true;
            }

            console.warn('Authentication check failed: invalid user data', data);
            currentUser.set(null);
            return false;
        } catch (error) {
            console.error('Auth check error:', error);
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

export async function signUp(email: string, password: string): Promise<User | null> {
	try {
		// Log the full URL we're trying to fetch
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
		if (!data.success) throw new Error(data.error);
		
		currentUser.set(data.user);
		return data.user;
	} catch (error) {
		console.error('Sign-up error:', error instanceof Error ? error.message : String(error));
		return null;
	}
}

export async function signIn(email: string, password: string): Promise<AuthModel | null> {
	try {
		// Log the full URL we're trying to fetch
		const url = '/api/verify/signin';
		console.log('Signing in at:', url);
		
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		
		// Check if response is ok
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
		if (!data.success) throw new Error(data.error);
		
		currentUser.set(data.user);
		return data.authData;
	} catch (error) {
		console.error('Sign-in error:', error instanceof Error ? error.message : String(error));
		return null;
	}
}

export async function signOut(): Promise<void> {
	try {
		// Log the full URL we're trying to fetch
		const url = '/api/verify/signout';
		console.log('Signing out at:', url);
		
		await fetch(url, {
			method: 'POST',
			credentials: 'include'
		});
		
		currentUser.set(null);
	} catch (error) {
		console.error('Sign-out error:', error);
	}
}

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
			const errorData = await response.json().catch(() => null);
			if (errorData && errorData.error) {
				throw new Error(errorData.error);
			}
			
			throw new Error(`Update user failed with status: ${response.status}`);
		}
		
		const data = await response.json();
		if (!data.success) throw new Error(data.error);
		
		// Update the current user if it's the same user
		if (id === data.user.id) {
			currentUser.set(data.user);
		}
		
		return data.user;
	} catch (error) {
		console.error('Update user error:', error);
		throw error;
	}
}

export async function getUserById(id: string): Promise<User | null> {
	// Check cache first
	const now = Date.now();
	const cachedUser = userCache.get(id);
	if (cachedUser && (now - cachedUser.timestamp < CACHE_DURATION)) {
	  return cachedUser.data;
	}
	
	try {
	  // Log the full URL we're trying to fetch
	  const url = `/api/verify/users/${id}`;
	  
	  const response = await fetch(url, {
		method: 'GET',
		credentials: 'include'
	  });
	  
	  // Check if response is ok
	  if (!response.ok) {
		console.error('Get user failed:', response.status, response.statusText);
		return null;
	  }
	  
	  const data = await response.json();
	  if (!data.success) throw new Error(data.error);
	  
	  // Store in cache
	  userCache.set(id, { data: data.user, timestamp: now });
	  
	  return data.user;
	} catch (error) {
	  console.error('Get user error:', error);
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

// ============= Cursor API Calls =============

// Cursor position is a special case that might require direct PocketBase usage
// on the client for real-time updates
export interface CursorChangeCallback {
	(data: { action: string; record: CursorPosition }): void;
}

export async function subscribeToCursorChanges(callback: CursorChangeCallback): Promise<() => void> {
	try {
		const response = await fetch('/api/network/cursor-subscribe', {
			method: 'POST',
			credentials: 'include'
		});
		
		// This is a placeholder since WebSockets can't be handled through REST
		// You'll need to implement a WebSocket connection directly
		console.warn('Cursor subscription through REST API is not fully implemented');
		
		// Return a dummy unsubscribe function
		return () => {
			fetch('/api/network/cursor-unsubscribe', {
				method: 'POST',
				credentials: 'include'
			}).catch(err => console.error('Error unsubscribing from cursor changes:', err));
		};
	} catch (error) {
		console.error('Error subscribing to cursor changes:', error);
		throw error;
	}
}

export async function publishCursorPosition(
	userId: string,
	x: number,
	y: number,
	name: string
): Promise<void> {
	try {
		await fetch('/api/network/cursor-position', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ userId, x, y, name })
		});
	} catch (error) {
		console.error('Error publishing cursor position:', error);
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

// ============= Workspace & Thread API Calls =============

export async function fetchUserActions(userId: string): Promise<Actions[]> {
	try {
		const response = await fetch(`/api/keys/users/${userId}/actions`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await response.json();
		if (!data.success) throw new Error(data.error);
		
		return data.actions;
	} catch (error) {
		console.error('Error fetching user actions:', error);
		throw error;
	}
}

export async function fetchUserFlows(userId: string): Promise<Workflows[]> {
	try {
		const response = await fetch(`/api/keys/users/${userId}/flows`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await response.json();
		if (!data.success) throw new Error(data.error);
		
		return data.flows;
	} catch (error) {
		console.error('Error fetching user flows:', error);
		throw error;
	}
}

export async function fetchUserWorkspaces(userId: string): Promise<Workspaces[]> {
	try {
		const response = await fetch(`/api/keys/users/${userId}/workspaces`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await response.json();
		if (!data.success) throw new Error(data.error);
		
		return data.workspaces;
	} catch (error) {
		console.error('Error fetching user workspaces:', error);
		return [];
	}
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