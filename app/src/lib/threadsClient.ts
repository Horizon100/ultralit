import type { Messages, Threads, Tag, AIModel, User} from '$lib/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { fetchNamingResponse } from '$lib/aiClient'

/** Utility to ensure user is authenticated */
function ensureAuthenticated(): void {
    if (!pb.authStore.isValid) {
        throw new Error('User is not authenticated');
    }
}

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        ensureAuthenticated();
        console.log(`Attempting to fetch messages for thread: ${threadId}`);

        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '-created',
            expand: 'user,parent_msg,task_relation,agent_relation,prompt_type,model'
        });

        console.log(`Fetched ${messages.length} messages for thread ${threadId}`);
        return messages;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function fetchLastMessageForThread(threadId: string): Promise<Messages | null> {
    try {
        ensureAuthenticated();


        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '-created', // Sort messages by creation date, descending
            limit: 1
        });

        return messages.length > 0 ? messages[0] : null;
    } catch (error) {
        console.error('Error fetching last message for thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function fetchThreads(): Promise<Threads[]> {
    try {
        ensureAuthenticated();

        // Fetch threads with expanded last_message field
        const threads = await pb.collection('threads').getFullList<Threads>({
            expand: 'last_message', // Ensure last_message is expanded
        });

        // If the last_message is expanded, you can access the details of the last message
        threads.forEach(thread => {
            if (thread.expand?.last_message) {
                console.log(`Last message for thread ${thread.id}:`, thread.expand.last_message);
            }
        });

        console.log('Fetched threads with last_message:', threads);
        return threads;
    } catch (error) {
        console.error('Error fetching threads:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}



export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
    try {
        ensureAuthenticated();


        const newThread: Partial<Threads> = {
            name: threadData.name || 'New Thread',
            op: pb.authStore.model?.id,
        };

        console.log('Attempting to create thread with data:', newThread);

        const createdThread = await pb.collection('threads').create<Threads>(newThread);
        console.log('Created thread:', createdThread);
        return createdThread;
    } catch (error) {
        console.error('Error creating thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function updateMessage(id: string, data: Partial<Messages>): Promise<Messages> {
    try {
        ensureAuthenticated();

        return await pb.collection('messages').update<Messages>(id, data);
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
        ensureAuthenticated();


        // If tags are being updated, ensure they're in the correct format
        if (changes.tags) {
            changes.tags = changes.tags.map(tag => {
                if (!tag.includes('#')) {
                    const color = getRandomBrightColor(tag);
                    return `${tag} #${color.slice(1)}`; // Remove the # from the color
                }
                return tag;
            });
        }

        return await pb.collection('threads').update<Threads>(id, changes);
    } catch (error) {
        console.error('Error updating thread:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function autoUpdateThreadName(threadId: string, userMessage: string, aiResponse: string, model: AIModel, userId: string): Promise<Threads> {
    try {
        ensureAuthenticated();


        // Get the AI-generated thread name
        const threadName = await fetchNamingResponse(userMessage, aiResponse, model, userId);

        // Update the thread with the new name
        return await pb.collection('threads').update<Threads>(threadId, {
            name: threadName
        });
    } catch (error) {
        console.error('Error auto-updating thread name:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

function getRandomBrightColor(tagName: string): string {
    const hash = tagName.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const h = hash % 360;
    return `hsl(${h}, 70%, 60%)`;
}

export async function addMessageToThread(message: Omit<Messages, 'id' | 'created' | 'updated'>): Promise<Messages> {
    try {
        ensureAuthenticated();


        console.log('Attempting to add message:', JSON.stringify(message, null, 2));
        console.log('User ID:', pb.authStore.model?.id);


        const createdMessage = await pb.collection('messages').create<Messages>(message);
        console.log('Created message:', createdMessage);
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

export async function resetThread(threadId: string): Promise<void> {
    try {
      ensureAuthenticated();
      
      if (!threadId) {
        throw new Error('Thread ID is required');
      }
  
      // Update the thread in the database if needed
      await pb.collection('threads').update(threadId, {
        selected: false
        // Add any other reset properties you need
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