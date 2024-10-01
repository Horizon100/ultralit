import type { Messages, Threads } from '$lib/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

        console.log(`Attempting to fetch messages for thread: ${threadId}`);

        const messages = await pb.collection('messages').getFullList<Messages>({
            filter: `thread = "${threadId}"`,
            sort: '-created',
            expand: 'user,parent_msg,task_relation,agent_relation'
        });

        console.log(`Fetched ${messages.length} messages for thread ${threadId}`);
        return messages;
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error('PocketBase error fetching messages:', error.data, error.message);
            console.error('Full error object:', JSON.stringify(error, null, 2));
        } else {
            console.error('Error fetching messages for thread:', error);
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
        if (error instanceof ClientResponseError) {
            console.error('PocketBase error fetching threads:', error.data, error.message);
        } else {
            console.error('Error fetching threads:', error);
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
        if (error instanceof ClientResponseError) {
            console.error('PocketBase error creating thread:', error.data, error.message);
        } else {
            console.error('Error creating thread:', error);
        }
        throw error;
    }
}

export async function updateMessage(id: string, data: Partial<Messages>): Promise<Messages> {
    return await pb.collection('messages').update<Messages>(id, data);
}

export async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
    try {
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

        return await pb.collection('threads').update<Threads>(id, changes);
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error('PocketBase error updating thread:', error.data, error.message);
        } else {
            console.error('Error updating thread:', error);
        }
        throw error;
    }
}

export async function addMessageToThread(message: Omit<Messages, 'id' | 'created' | 'updated'>): Promise<Messages> {
    try {
        if (!pb.authStore.isValid) {
            throw new Error('User is not authenticated');
        }

        const createdMessage = await pb.collection('messages').create<Messages>(message);
        return createdMessage;
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error('PocketBase error adding message to thread:', error.data, error.message);
        } else {
            console.error('Error adding message to thread:', error);
        }
        throw error;
    }
}