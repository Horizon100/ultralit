import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { ensureAuthenticated, currentUser } from '$lib/pocketbase'; // Client-side import
import { processMarkdown } from '$lib/scripts/markdownProcessor';
import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
import { projectStore } from '$lib/stores/projectStore';
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { fetchThreadsForProject } from '$lib/clients/projectClient';

// Throttling variables
let isLoadingAllThreads = false;
let lastThreadLoadTime = 0;

const CACHE_DURATION = 10000;

const messageCache = new Map<string, {
    messages: Messages[],
    timestamp: number
}>();

// Thread list visibility functions
export function isThreadListVisible(): boolean {
    return get(showThreadList);
}

export function toggleThreadList(): void {
    threadsStore.toggleThreadList();
}

export function setThreadListVisibility(visible: boolean): void {
    threadsStore.setThreadListVisibility(visible);
}

// Export a consistent interface for thread list visibility management
export const threadListVisibility = {
    get: isThreadListVisible,
    set: setThreadListVisibility,
    toggle: toggleThreadList
};
/**
 * Fetch threads from the server API
 * @param projectId Optional project ID to filter threads
 * @returns Promise<any[]> Array of thread objects
 */
export async function fetchThreads(projectId: string | null = null): Promise<any[]> {
    try {
      // Skip ensureAuthenticated since it's causing issues
      const user = get(currentUser);
      
      if (!user?.token) {
        console.warn('No user token found, but continuing with request');
      }
  
      // Build the URL with project parameter if provided
      let url = '/api/threads';
      if (projectId) {
        url = `${url}?project=${projectId}`;
      }
  
      console.log(`Fetching threads from ${url}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if we have a token
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.threads?.length || 0} threads from API`);
      return data.threads || [];
    } catch (error) {
      console.error('Error fetching threads:', error);
      return []; // Return empty array instead of throwing
    }
  }
  
  /**
   * Fetch threads for a project from the API
   * @param projectId Project ID
   * @returns Promise with thread array
   */
  export async function fetchProjectThreads(projectId: string): Promise<any[]> {
    return fetchThreads(projectId);
  }
  
  /**
   * Fetch unassigned threads (not belonging to any project)
   * @returns Promise with thread array
   */
  export async function fetchUnassignedThreads(): Promise<any[]> {
    return fetchThreads(null);
  }
  

/**
 * Fetch all threads regardless of project
 * Special function to get ALL threads across all projects
 * @returns Promise with thread array
 */
export async function fetchAllThreads(): Promise<any[]> {
    try {
      // Don't call ensureAuthenticated() here since it's throwing an error
      const user = get(currentUser);
      
      if (!user?.token) {
        console.warn('No user token found, but continuing with request');
      }
  
      // Use a special query parameter to indicate we want ALL threads
      const url = '/api/threads?all=true';
      console.log(`Fetching all threads from ${url}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if we have a token
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.threads?.length || 0} total threads from API`);
      return data.threads || [];
    } catch (error) {
      console.error('Error fetching all threads:', error);
      return []; // Return empty array instead of throwing
    }
  }
  
  /**
   * Load threads based on project context and update the store
   * @param projectId Optional project ID to filter threads by
   * @returns Promise that resolves when threads are loaded
   */
/**
 * Load threads based on project context and update the store
 * @param projectId Optional project ID to filter threads by
 * @returns Promise that resolves when threads are loaded
 */
export async function loadThreads(projectId: string | null): Promise<void> {
    const now = Date.now();
    // Throttle repeated calls to prevent hammering the API
    if (isLoadingAllThreads || (now - lastThreadLoadTime < 2000)) {
        console.log('Skipping thread reload due to throttling');
        return;
    }

    isLoadingAllThreads = true;
    
    try {
        // Set loading state but don't clear threads yet to avoid UI flicker
        threadsStore.update(state => ({
            ...state,
            isLoading: true,
            error: null
        }));

        console.log(`Loading threads for ${projectId ? `project ${projectId}` : 'all projects'}`);
        
        // Fetch threads from API based on projectId
        let threads;
        
        try {
            if (projectId) {
                // Fetch threads for the specific project
                threads = await fetchThreads(projectId);
            } else {
                // If null is explicitly provided, we want all threads across all projects
                threads = await fetchAllThreads();
            }
        } catch (fetchError) {
            console.error('Error fetching threads:', fetchError);
            // Return early but don't throw - keep existing threads in the store
            threadsStore.update(state => ({
                ...state,
                isLoading: false,
                error: fetchError instanceof Error ? fetchError.message : 'Failed to fetch threads',
                updateStatus: 'Failed to load threads'
            }));
            isLoadingAllThreads = false;
            return;
        }
        
        console.log(`Successfully loaded ${threads.length} threads`);
        
        // Ensure project_id is consistently set on all threads
        const processedThreads = threads.map(thread => ({
            ...thread,
            // Ensure project_id is set consistently for filtering
            project_id: thread.project_id || thread.project || null
        }));

        // Update the store with all threads
        threadsStore.update(state => {
            return {
                ...state,
                threads: processedThreads,
                filteredThreads: processedThreads,
                isThreadsLoaded: true,
                isLoading: false,
                project_id: projectId,
                updateStatus: 'Threads loaded successfully',
                error: null
            };
        });

        lastThreadLoadTime = now;
    } catch (error) {
        console.error('Error in loadThreads:', error);
        threadsStore.update(state => ({
            ...state,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load threads',
            updateStatus: 'Failed to load threads'
        }));
    } finally {
        isLoadingAllThreads = false;
    }
}
function invalidateThreadCache(threadId: string) {
    messageCache.delete(threadId);
}



let isFetching = false;

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    if (isFetching) {
        console.warn('Prevented recursive fetch for thread', threadId);
        return [];
    }
    
    try {
        isFetching = true;
        await ensureAuthenticated();
        
        const cached = messageCache.get(threadId);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.messages;
        }
        
        const response = await fetch(`/api/keys/threads/${threadId}/messages`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch messages');
        }
        
        const messages = data.messages || [];
        const processedMessages = messages.map((message: Messages) => ({
            ...message,
            text: processMarkdown(message.text)
        }));
        
        messageCache.set(threadId, {
            messages: processedMessages,
            timestamp: Date.now()
        });
        
        return processedMessages;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        throw error;
    } finally {
        isFetching = false;
    }
}

export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
    try {
        await ensureAuthenticated();
        const userId = get(currentUser)?.id;
        if (!userId) throw new Error('User ID not found');

        const projectId = threadData.project_id || threadData.project;
        
        const newThread: Partial<Threads> = {
            name: threadData.name || 'New Thread',
            op: userId,
            user: userId,
            members: threadData.members || [userId],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            tags: threadData.tags || [],
            current_thread: '',
            ...(projectId ? { project: projectId, project_id: projectId } : {})
        };

        const response = await fetch('/api/threads', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token}`
            },
            body: JSON.stringify(newThread)
        });
        
        if (!response.ok) throw new Error(`Failed to create thread: ${response.status}`);
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to create thread');
        
        return {
            ...data.thread,
            project_id: projectId || data.thread.project_id
        };
    } catch (error) {
        console.error('Thread creation failed:', error);
        throw error;
    }
}

export async function updateMessage(id: string, data: Partial<Messages>): Promise<Messages> {
    try {
        await ensureAuthenticated();

        const processedData = data.text
            ? {
                    ...data,
                    text: processMarkdown(data.text)
                }
            : data;

        // Update message via API endpoint instead of direct PocketBase access
        const response = await fetch(`/api/keys/messages/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(processedData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update message: ${response.status}`);
        }
        
        const responseData = await response.json();
        if (!responseData.success) {
            throw new Error(responseData.message || 'Failed to update message');
        }
        
        const updatedMessage = responseData.message;
        
        if (updatedMessage.thread) {
            invalidateThreadCache(updatedMessage.thread);
        }
        
        return updatedMessage;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
}

export async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
    try {
        await ensureAuthenticated();

        if (changes.project_id || changes.project) {
            const projectId = changes.project_id || changes.project;
            changes = {
                ...changes,
                project: projectId,
                project_id: projectId
            };
        }

        const response = await fetch(`/api/threads/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token}`
            },
            body: JSON.stringify(changes)
        });
        
        if (!response.ok) throw new Error(`Failed to update thread: ${response.status}`);
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to update thread');
        
        // Update store
        threadsStore.update(state => ({
            ...state,
            threads: state.threads.map(t => 
                t.id === id ? data.thread : t
            )
        }));
        
        return data.thread;
    } catch (error) {
        console.error('Thread update failed:', error);
        throw error;
    }
}

export async function resetThread(threadId: string): Promise<void> {
    try {
        await ensureAuthenticated();

        if (!threadId) {
            throw new Error('Thread ID is required');
        }
        
        // Reset thread via API endpoint
        const response = await fetch(`/api/keys/threads/${threadId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selected: false })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to reset thread: ${response.status}`);
        }

        console.log('Thread reset successfully');
    } catch (error) {
        console.error('Error resetting thread:', error);
        throw error;
    }
}

export async function addMessageToThread(
    message: Omit<Messages, 'id' | 'created' | 'updated'>
): Promise<Messages> {
    try {
        await ensureAuthenticated();

        console.log('Attempting to add message:', JSON.stringify(message, null, 2));
        
        const processedMessage = {
            ...message,
            // text: processMarkdown(message.text)
        };

        const response = await fetch('/api/keys/messages', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token || ''}`
            },
            body: JSON.stringify(processedMessage)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create message: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to create message');
        }
        
        const createdMessage = data.message;
        
        console.log('Created message:', createdMessage);
        
        if (message.thread) {
            try {
                // Update thread timestamp via the correct API endpoint
                await fetch(`/api/threads/${message.thread}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${get(currentUser)?.token || ''}`
                    },
                    body: JSON.stringify({
                        updated: new Date().toISOString()
                    })
                });
                
                console.log(`Updated thread ${message.thread} timestamp successfully`);
            } catch (updateError) {
                console.error('Error updating thread timestamp:', updateError);
            }
        }

        return createdMessage;
    } catch (error) {
        console.error('Error adding message to thread:', error);
        throw error;
    }
}

// We need to create a new endpoint for thread messages
export function setupMessageListener(threadId: string, onNewMessage: () => void) {
    try {
        // Set up polling instead of websocket subscription
        const pollInterval = 3000; // Poll every 3 seconds
        
        console.log(`Setting up polling for thread ${threadId}`);
        
        const intervalId = setInterval(async () => {
            try {
                // Fetch the latest messages and check for updates
                const response = await fetch(`/api/keys/threads/${threadId}/messages`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    // Invalidate cache to force refresh
                    invalidateThreadCache(threadId);
                    
                    // Call the callback to refresh UI
                    onNewMessage();
                }
            } catch (error) {
                console.error('Error polling for messages:', error);
            }
        }, pollInterval);
        
        return () => {
            clearInterval(intervalId);
            console.log(`Cleaned up polling for thread ${threadId}`);
        };
    } catch (error) {
        console.error('Error setting up message listener:', error);
        return () => {}; // Return dummy cleanup function
    }
}

export async function autoUpdateThreadName(
    threadId: string,
    messages: Messages[],
    model: AIModel,
    userId: string
): Promise<Threads | null> {
    try {
        // First check if thread exists in the store
        const existingThreads = get(threadsStore).threads;
        const threadExists = existingThreads.some(t => t.id === threadId);
        
        if (!threadExists) {
            console.log(`Thread ${threadId} not found in store, fetching before naming`);
            // Fetch thread if not in store
            try {
                const threadResponse = await fetch(`/api/keys/threads/${threadId}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${get(currentUser)?.token || ''}`
                    }
                });
                
                if (threadResponse.ok) {
                    const threadData = await threadResponse.json();
                    if (threadData.success && threadData.thread) {
                        // Add thread to store
                        threadsStore.update(state => ({
                            ...state,
                            threads: [threadData.thread, ...state.threads.filter(t => t.id !== threadId)]
                        }));
                        console.log(`Added thread ${threadId} to store`);
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching thread before naming:', fetchError);
            }
        }
        
        // Now update the thread name
        await updateThreadNameIfNeeded(threadId, messages, model, userId);
        
        // Get the updated thread
        const response = await fetch(`/api/keys/threads/${threadId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token || ''}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch updated thread: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch updated thread');
        }
        
        // Also update the thread in the store to ensure consistency
        const updatedThread = data.thread;
        if (updatedThread) {
            threadsStore.update(state => ({
                ...state,
                threads: state.threads.map(t => 
                    t.id === threadId ? updatedThread : t
                )
            }));
        }
        
        return updatedThread;
    } catch (error) {
        console.error('Error in autoUpdateThreadName:', error);
        return null;
    }
}

export async function fetchMessagesForBookmark(bookmarkId: string): Promise<Messages[]> {
    try {
        await ensureAuthenticated();
        console.log(`Attempting to fetch bookmarked messages: ${bookmarkId}`);

        // Replace the PocketBase call with a fetch to your API
        const response = await fetch(`/api/bookmarks/${bookmarkId}/messages`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token || ''}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch bookmarked messages: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch bookmarked messages');
        }
        
        const messages = data.messages || [];
        const processedMessages = messages.map((message: Messages) => ({
            ...message,
            text: processMarkdown(message.text)
        }));

        console.log(`Fetched ${processedMessages.length} messages for bookmark ${bookmarkId}`);
        return processedMessages;
    } catch (error) {
        console.error('Error fetching messages for bookmark:', error);
        throw error;
    }
}

// Function to get the current thread state
export function getCurrentThread(): Threads | null {
    const state = get(threadsStore);
    return state.currentThread;
}

// Function to set the current thread
export function setCurrentThread(threadId: string | null): void {
    threadsStore.setCurrentThread(threadId);
}