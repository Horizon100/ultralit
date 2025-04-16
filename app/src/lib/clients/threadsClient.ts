import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { ensureAuthenticated, currentUser } from '$lib/pocketbase'; // Client-side import
import { ClientResponseError } from 'pocketbase';
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { threadsStore } from '$lib/stores/threadsStore';
import { processMarkdown } from '$lib/scripts/markdownProcessor';

const CACHE_DURATION = 10000;

const messageCache = new Map<string, {
    messages: Messages[],
    timestamp: number
}>();

function invalidateThreadCache(threadId: string) {
    messageCache.delete(threadId);
}

export async function fetchThreads(): Promise<Threads[]> {
    try {
        await ensureAuthenticated();
        
        const response = await fetch('/api/keys/threads', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch threads: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch threads');
        }
        
        const allThreads = data.threads || [];
        
        const currentState = get(threadsStore);
        
        return allThreads.map((thread: Threads) => ({
            ...thread,
            showThreadList: currentState?.showThreadList ?? true,
            tags: thread.tags || [],
            current_thread: thread.current_thread || ''
          }));
    } catch (error) {
        console.error('Error fetching threads:', error);
        
        const currentState = get(threadsStore);
        return currentState.threads || [];
    }
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
        
        // Ensure project_id field name is consistent
        const projectId = threadData.project_id || threadData.project;
        console.log('Project ID:', projectId);

        const newThread: Partial<Threads> = {
            name: threadData.name || 'New Thread',
            op: userId,
            user: userId,  // Ensure user field is set
            members: threadData.members || [userId],  // Add current user as member if not specified
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            tags: threadData.tags || [],
            current_thread: '',
            project: projectId,  // Use project field consistently
            project_id: projectId  // Also set project_id for backward compatibility
        };

        console.log('Creating thread with data:', newThread);

        // Create thread via API endpoint instead of direct PocketBase access
        const response = await fetch('/api/keys/threads', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newThread)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create thread: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to create thread');
        }
        
        const createdThread = data.thread;

        return {
            ...createdThread,
            ...(threadData.showThreadList !== undefined && {
                showThreadList: threadData.showThreadList
            })
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

        // Create message via API endpoint
        const response = await fetch('/api/keys/messages', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
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
			invalidateThreadCache(message.thread);
			
			try {
				// Update thread timestamp via API endpoint
				await fetch(`/api/keys/threads/${message.thread}`, {
					method: 'PATCH',
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json'
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
        
        // Return a cleanup function
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
        await ensureAuthenticated();

        await updateThreadNameIfNeeded(threadId, messages, model, userId);

        const updatedThread = await pb.collection('threads').getOne<Threads>(threadId);
        return updatedThread;
    } catch (error) {
        console.error('Error in autoUpdateThreadName:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        return null;
    }
}


export async function fetchMessagesForBookmark(bookmarkId: string): Promise<Messages[]> {
    try {
        await ensureAuthenticated();
        console.log(`Attempting to fetch bookmarked messages: ${bookmarkId}`);

        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `id = "${bookmarkId}"`,
            sort: '+created'  // Changed to oldest first for consistency
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