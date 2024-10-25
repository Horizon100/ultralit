import type { Messages, Threads, Tag } from '$lib/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { fetchNamingResponse } from '$lib/aiClient'

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

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

export async function fetchThreads(): Promise<Threads[]> {
    try {
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

        const threads = await pb.collection('threads').getFullList<Threads>();
        console.log('Fetched threads:', threads);
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
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

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
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }
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
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

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
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

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
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

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