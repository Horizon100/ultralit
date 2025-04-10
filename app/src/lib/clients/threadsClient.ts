import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { pb, ensureAuthenticated } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { threadsStore } from '$lib/stores/threadsStore';
import { processMarkdown } from '$lib/scripts/markdownProcessor';

// Increase cache duration to 10 seconds to prevent frequent refetching
const CACHE_DURATION = 10000;

// Message cache to avoid frequent refetching
const messageCache = new Map<string, {
    messages: Messages[],
    timestamp: number
}>();

// Function to invalidate cache for a thread
function invalidateThreadCache(threadId: string) {
    messageCache.delete(threadId);
}

export async function fetchThreads(): Promise<Threads[]> {
    try {
        await ensureAuthenticated();
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User ID not found');
        }
        
        // Use multiple simpler queries to avoid filter syntax issues
        const userThreads = await pb.collection('threads').getFullList<Threads>({
            sort: '-created',
            filter: `user = "${userId}"`,
            expand: 'project,op,members',
            $autoCancel: false
        });
        
        const opThreads = await pb.collection('threads').getFullList<Threads>({
            sort: '-created',
            filter: `op = "${userId}"`,
            expand: 'project,op,members',
            $autoCancel: false
        });
        
        const memberThreads = await pb.collection('threads').getFullList<Threads>({
            sort: '-created',
            filter: `members ~ "${userId}"`,
            expand: 'project,op,members',
            $autoCancel: false
        });
        
        // Combine results, removing duplicates
        const allThreads = [...userThreads];
        const seenIds = new Set(allThreads.map(t => t.id));
        
        for (const thread of [...opThreads, ...memberThreads]) {
            if (!seenIds.has(thread.id)) {
                allThreads.push(thread);
                seenIds.add(thread.id);
            }
        }
        
        // Sort combined results by creation date
        allThreads.sort((a, b) => 
            new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        
        const currentState = get(threadsStore);
        
        // Return with proper defaults
        return allThreads.map(thread => ({
            ...thread,
            showThreadList: currentState?.showThreadList ?? true,
            tags: thread.tags || [],
            current_thread: thread.current_thread || ''
        }));
    } catch (error) {
        console.error('Error fetching threads:', error);
        if (error instanceof ClientResponseError) {
            console.error('PocketBase Response Error:', {
                status: error.status,
                data: error.data,
                message: error.message,
                url: error.url
            });

            if (error.status === 401) {
                const currentState = get(threadsStore);
                return currentState.threads || [];
            }
        }

        const currentState = get(threadsStore);
        return currentState.threads || [];
    }
}

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        await ensureAuthenticated();
        
        // Check cache first
        const cached = messageCache.get(threadId);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.messages;
        }
        
        // Fetch messages with oldest first (important for conversation flow)
        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '+created'  // Changed to oldest first for proper conversation flow
        });

        const processedMessages = messages.map((message) => ({
            ...message,
            text: processMarkdown(message.text)
        }));
        
        // Cache the result
        messageCache.set(threadId, {
            messages: processedMessages,
            timestamp: Date.now()
        });
        
        console.log(`Fetched ${processedMessages.length} messages for thread ${threadId}`);
        return processedMessages;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
    try {
        await ensureAuthenticated();
        const userId = pb.authStore.model?.id;
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

        let createdThread: Threads | null = null;

        try {
            createdThread = await pb.collection('threads').create<Threads>(newThread);
            console.log('Thread created:', createdThread);
            
            if (projectId) {
                try {
                    const project = await pb
                        .collection('projects')
                        .getOne<Projects>(projectId);

                    const updatedThreads = Array.isArray(project.threads)
                        ? [...project.threads, createdThread.id]
                        : [createdThread.id];

                    await pb.collection('projects').update(projectId, {
                        threads: updatedThreads
                    });
                    console.log('Project updated with new thread');
                } catch (error) {
                    console.error('Project update failed:', error);

                    if (createdThread?.id) {
                        await pb.collection('threads').delete(createdThread.id);
                    }
                    
                    throw error;
                }
            }

            return {
                ...createdThread,
                ...(threadData.showThreadList !== undefined && {
                    showThreadList: threadData.showThreadList
                })
            };
        } catch (error) {
            console.error('Thread creation failed:', error);
            throw error;
        }
    } catch (error) {
        console.error('Thread creation process failed:', error);

        if (error instanceof ClientResponseError) {
            console.error('PocketBase error details:', {
                status: error.status,
                message: error.message,
                data: error.data,
                url: error.url
            });
        }

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

        const updatedMessage = await pb.collection('messages').update<Messages>(id, processedData);
        
        // Find which thread this message belongs to and invalidate its cache
        if (updatedMessage.thread) {
            invalidateThreadCache(updatedMessage.thread);
        }
        
        return updatedMessage;
    } catch (error) {
        console.error('Error updating message:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
    try {
        await ensureAuthenticated();

        const currentThread = await pb.collection('threads').getOne<Threads>(id);
        
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
        
        const updatedThread = await pb.collection('threads').update<Threads>(id, updateData);

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
        if (error instanceof ClientResponseError) { 
            console.error('Response details:', {
                status: error.status,
                data: error.data
            });
            
            // Get the specific field errors if available
            if (error.data?.data) {
                console.error('Field validation errors:', error.data.data);
            }
            
            throw new Error(`Thread update failed: ${error.status} - ${error.data?.message || 'Unknown error'}`); 
        } else if (error instanceof Error) { 
            throw new Error(`Thread update failed: ${error.message}`); 
        } else {
            throw new Error('An unknown error occurred during thread update.');
        }
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

        const createdMessage = await pb.collection('messages').create<Messages>(processedMessage);
        console.log('Created message:', createdMessage);
        
		if (message.thread) {
			invalidateThreadCache(message.thread);
			
			try {
				await pb.collection('threads').update(message.thread, {
					updated: new Date().toISOString()
				});
				console.log(`Updated thread ${message.thread} timestamp successfully`);
			} catch (updateError) {
				console.error('Error updating thread timestamp:', updateError);
			}
		}

        return createdMessage;
    } catch (error) {
        console.error('Error adding message to thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
            console.error('Error details:', error.data?.data);
        }
        throw error;
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

export async function resetThread(threadId: string): Promise<void> {
    try {
        await ensureAuthenticated();

        if (!threadId) {
            throw new Error('Thread ID is required');
        }
        await pb.collection('threads').update(threadId, {
            selected: false
        });

        console.log('Thread reset successfully');
    } catch (error) {
        console.error('Error resetting thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

// Setup real-time subscription for messages in a thread
export function subscribeToThreadMessages(threadId: string, callback: (data: any) => void) {
    try {
        console.log(`Subscribing to messages for thread ${threadId}`);
        return pb.collection('messages').subscribe(`thread="${threadId}"`, callback);
    } catch (error) {
        console.error('Error setting up thread subscription:', error);
        return () => {}; // Return dummy unsubscribe function
    }
}

// Function to setup message listening in a component
export function setupMessageListener(threadId: string, onNewMessage: () => void) {
    try {
        return subscribeToThreadMessages(threadId, async (data) => {
            console.log('Message update received:', data);
            
            // Invalidate cache for this thread
            invalidateThreadCache(threadId);
            
            // Call the callback to refresh UI
            onNewMessage();
        });
    } catch (error) {
        console.error('Error setting up message listener:', error);
        return () => {}; // Return dummy unsubscribe function
    }
}