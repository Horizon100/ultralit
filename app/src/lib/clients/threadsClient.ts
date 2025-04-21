import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { ensureAuthenticated, currentUser } from '$lib/pocketbase'; // Client-side import
import { ClientResponseError } from 'pocketbase';
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { threadsStore } from '$lib/stores/threadsStore';
import { processMarkdown } from '$lib/scripts/markdownProcessor';
import { projectStore } from '$lib/stores/projectStore';
import { fetchThreadsForProject } from '$lib/clients/projectClient';
// Throttling variables
let isLoadingAllThreads = false;
let lastThreadLoadTime = 0;

const CACHE_DURATION = 10000;

const messageCache = new Map<string, {
    messages: Messages[],
    timestamp: number
}>();

export async function loadAllThreads(): Promise<void> {
    // Throttle requests - don't reload if we've loaded in the last 5 seconds
    const now = Date.now();
    if (isLoadingAllThreads || (now - lastThreadLoadTime < 5000)) {
      console.log('Skipping thread reload - already loading or recently loaded');
      return;
    }
  
    isLoadingAllThreads = true;
    
    try {
      console.log('Loading all threads for all projects');
      
      threadsStore.update(state => ({
        ...state,
        isThreadsLoaded: false,
        loadingError: null
      }));
      
      // Get all projects from projectStore
      const projects = get(projectStore).threads || [];
      console.log(`Found ${projects.length} projects, loading threads for each`);
      
      // Use a map to collect threads by ID to avoid duplicates
      const allThreadsMap = new Map();
      
      // Collect threads from all projects
      for (const project of projects) {
        if (project.id) {
          try {
            // Fetch threads for this project
            const projectThreads = await fetchThreadsForProject(project.id);
            console.log(`Fetched ${projectThreads.length} threads for project ${project.id} (${project.name})`);
            
            // Store threads in map, using ID as key to avoid duplicates
            projectThreads.forEach(thread => {
              if (thread.id) {
                allThreadsMap.set(thread.id, {
                  ...thread,
                  project_id: project.id
                });
              }
            });
          } catch (error) {
            console.warn(`Error fetching threads for project ${project.id}:`, error);
            // Continue with other projects
          }
        }
      }
      
      // Convert map to array
      const allThreads = Array.from(allThreadsMap.values());
      console.log(`Collected ${allThreads.length} total threads from ${projects.length} projects`);
      
      // Update threads store
      threadsStore.update(state => {
        // Apply current search query if it exists
        let filteredThreads = allThreads;
        if (state.searchQuery) {
          filteredThreads = allThreads.filter(thread => 
            thread.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
          );
        }
        
        return {
          ...state,
          threads: allThreads,
          searchedThreads: filteredThreads,
          isThreadsLoaded: true,
          showThreadList: true,
          currentProjectId: get(projectStore).currentProjectId
        };
      });
      
      // Record successful load time
      lastThreadLoadTime = Date.now();
    } catch (error) {
      console.error('Error loading all threads:', error);
      threadsStore.update(state => ({
        ...state,
        loadingError: error instanceof Error ? error.message : 'Failed to load threads',
        isThreadsLoaded: true // Prevent infinite loading state
      }));
    } finally {
      isLoadingAllThreads = false;
    }
  }
  
  /**
   * Modified function to load threads for a specific project or all threads
   */
  export async function loadProjectThreads(projectId?: string): Promise<void> {
    // If no project ID, load all threads across projects
    if (!projectId) {
      return loadAllThreads();
    }
    
    // Otherwise load threads for specific project
    try {
      console.log(`Loading threads for project ${projectId}`);
      
      threadsStore.update(state => ({
        ...state,
        isThreadsLoaded: false,
        loadingError: null
      }));
      
      // Fetch threads for this project
      const projectThreads = await fetchThreadsForProject(projectId);
      console.log(`Fetched ${projectThreads.length} threads for project ${projectId}`);
      
      // Ensure each thread has project_id set
      const validatedThreads = projectThreads.map(thread => ({
        ...thread,
        project_id: thread.project_id || projectId
      }));
      
      // Update threads store
      threadsStore.update(state => {
        // Apply current search query if it exists
        let filteredThreads = validatedThreads;
        if (state.searchQuery) {
          filteredThreads = validatedThreads.filter(thread => 
            thread.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
          );
        }
        
        return {
          ...state,
          threads: validatedThreads,
          searchedThreads: filteredThreads,
          isThreadsLoaded: true,
          showThreadList: true,
          currentProjectId: projectId
        };
      });
    } catch (error) {
      console.error(`Error loading threads for project ${projectId}:`, error);
      threadsStore.update(state => ({
        ...state,
        loadingError: error instanceof Error ? error.message : 'Failed to load threads',
        isThreadsLoaded: true // Prevent infinite loading state
      }));
    }
  }
function invalidateThreadCache(threadId: string) {
    messageCache.delete(threadId);
}

export async function fetchThreads(): Promise<Threads[]> {
    try {
        await ensureAuthenticated();
        console.log('Fetching all threads for user');
        
        const response = await fetch('/api/threads', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token}` // Add auth token
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to fetch threads: ${response.status}`);
        }
        
        const data = await response.json();
        return data.threads || [];
    } catch (error) {
        console.error('Error fetching threads:', error);
        throw error;
    }
}
// Helper function to process threads consistently
function processThreads(threads: any[], currentState: any): Threads[] {
    return threads.map((thread: any) => ({
        ...thread,
        showThreadList: currentState?.showThreadList ?? true,
        tags: thread.tags || [],
        current_thread: thread.current_thread || ''
    }));
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
        const processedMessages = messages.map((message) => ({
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
        if (!userId) {
            throw new Error('User ID not found');
        }

        console.log('Received threadData:', threadData);
        
        // Extract project ID from any field it might be in
        const projectId = threadData.project_id || threadData.project;
        console.log('Project ID:', projectId);

        const newThread: Partial<Threads> = {
            name: threadData.name || 'New Thread',
            op: userId,
            user: userId,  
            members: threadData.members || [userId],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            tags: threadData.tags || [],
            current_thread: '',
        };

        // Add both project and project_id fields if a projectId exists
        if (projectId) {
            newThread.project = projectId;
            newThread.project_id = projectId;
        }

        console.log('Creating thread with data:', newThread);

        // Create thread via API endpoint
        const response = await fetch('/api/keys/threads', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token || ''}`  // Add auth token
            },
            body: JSON.stringify(newThread)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create thread: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to create thread');
        }
        
        let createdThread = data.thread;
        
        // If the API didn't set project_id but we have one, set it manually
        if (projectId && !createdThread.project_id) {
            createdThread = {
                ...createdThread,
                project_id: projectId
            };
            
            // Also update the thread to ensure project_id is saved
            try {
                await fetch(`/api/keys/threads/${createdThread.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${get(currentUser)?.token || ''}`
                    },
                    body: JSON.stringify({ project_id: projectId })
                });
                console.log(`Updated thread ${createdThread.id} with project_id ${projectId}`);
            } catch (updateError) {
                console.warn('Failed to update thread with project_id:', updateError);
            }
        }

        return {
            ...createdThread,
            project_id: projectId || createdThread.project_id,  
            showThreadList: threadData.showThreadList !== undefined 
                ? threadData.showThreadList 
                : false
        };
    } catch (error) {
        console.error('Thread creation process failed:', error);
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
        
        // Find which thread this message belongs to and invalidate its cache
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

        // Get current thread data
        const threadResponse = await fetch(`/api/keys/threads/${id}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!threadResponse.ok) {
            throw new Error(`Failed to fetch thread: ${threadResponse.status}`);
        }
        
        const threadData = await threadResponse.json();
        if (!threadData.success) {
            throw new Error(threadData.message || 'Failed to fetch thread');
        }
        
        const currentThread = threadData.thread;
        
        const updateData: Record<string, any> = {};
        
        Object.keys(changes).forEach(key => {
            if (changes[key as keyof Partial<Threads>] !== undefined && key !== 'showThreadList') {
                updateData[key] = changes[key as keyof Partial<Threads>];
            }
        });
        
        if (Object.keys(updateData).length === 0) {
            console.log('No valid changes to update for thread:', id);
            return currentThread;
        }
        
        console.log('Updating thread with data:', updateData);
        
        // Update thread via API endpoint
        const response = await fetch(`/api/keys/threads/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update thread: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to update thread');
        }
        
        const updatedThread = data.thread;
        
        console.log('Thread updated successfully:', updatedThread);
        
        // Reapply showThreadList which isn't stored in the database
        const result = {
            ...updatedThread,
            showThreadList: currentThread.showThreadList !== undefined 
                ? currentThread.showThreadList 
                : get(threadsStore).showThreadList
        };
        
        return result;
    } catch (error) {
        console.error('Thread update failed:', error);
        throw new Error(`Thread update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

// For other functions that need real-time capabilities, we'll need to implement
// alternative solutions since we can't use PocketBase's subscribe features directly

// Create an endpoint for messages in a thread
export async function addMessageToThread(
    message: Omit<Messages, 'id' | 'created' | 'updated'>
): Promise<Messages> {
    try {
        await ensureAuthenticated();

        console.log('Attempting to add message:', JSON.stringify(message, null, 2));
        
        const processedMessage = {
            ...message,
            text: processMarkdown(message.text)
        };

        // Use the correct API endpoint - based on your structure, it should be:
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

        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `id = "${bookmarkId}"`,
            sort: '+created'
        });

        const processedMessages = messages.map((message) => ({
            ...message,
            text: processMarkdown(message.text)
        }));

        console.log(`Fetched ${processedMessages.length} messages for bookmark ${bookmarkId}`);
        return processedMessages;
    } catch (error) {
        console.error('Error fetching messages for bookmark:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}