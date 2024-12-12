import { writable, get } from 'svelte/store';
import type { Messages, Threads, Tag } from '$lib/types';
import { pb } from '$lib/pocketbase';
import { fetchMessagesForThread, addMessageToThread } from '$lib/threadsClient';
import { User } from 'lucide-svelte';

// Add this function to your threadsClient.ts file and export it
async function updateMessage(id: string, data: Partial<Messages>): Promise<Messages> {
    return await pb.collection('messages').update<Messages>(id, data);
}

function createMessagesStore() {
    const { subscribe, set, update } = writable<Messages[]>([]);

    return {
        subscribe,
        setMessages: (messages: Messages[]) => set(messages),
        addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>) => {
            try {
                const newMessage = await addMessageToThread(message);
                update(messages => [...messages, newMessage]);
                return newMessage;
            } catch (error) {
                console.error('Error adding message:', error);
                throw error;
            }
        },
        fetchMessages: async (threadId: string) => {
            try {
                const messages = await fetchMessagesForThread(threadId);
                set(messages);
            } catch (error) {
                console.error('Error fetching messages:', error);
                throw error;
            }
        },
        saveMessage: async (message: Partial<Messages>, threadId: string) => {
            try {
                if (!pb.authStore.isValid) {
                    throw new Error('User is not authenticated');
                }

                const userId = pb.authStore.model?.id;
                if (!userId) {
                    throw new Error('User ID not found');
                }

                const newMessage: Omit<Messages, 'id' | 'created' | 'updated'> = {
                    text: message.text || '',
                    user: userId,
                    parent_msg: message.parent_msg || null,
                    task_relation: message.task_relation || null,
                    agent_relation: message.agent_relation || null,
                    type: message.type || 'human',
                    read_by: [userId],
                    thread: threadId,
                    attachments: message.attachments || '',
                    reactions: message.reactions || {},
                    prompt_type: message.prompt_type || null,
                    model: userId.selected_model || null,

                };

                const savedMessage = await addMessageToThread(newMessage);
                update(messages => [...messages, savedMessage]);
                return savedMessage;
            } catch (error) {
                console.error('Error saving message:', error);
                throw error;
            }
        },
        addReaction: async (messageId: string, reaction: string) => {
            try {
                const messages = get(messagesStore);
                const message = messages.find(m => m.id === messageId);
                if (!message) {
                    throw new Error('Message not found');
                }

                const updatedReactions = { ...message.reactions };
                updatedReactions[reaction] = (updatedReactions[reaction] || 0) + 1;

                const updatedMessage = await updateMessage(messageId, { reactions: updatedReactions });
                
                update(messages => messages.map(m => m.id === messageId ? updatedMessage : m));
                return updatedMessage;
            } catch (error) {
                console.error('Error adding reaction:', error);
                throw error;
            }
        },
        removeReaction: async (messageId: string, reaction: string) => {
            try {
                const messages = get(messagesStore);
                const message = messages.find(m => m.id === messageId);
                if (!message) {
                    throw new Error('Message not found');
                }

                const updatedReactions = { ...message.reactions };
                if (updatedReactions[reaction] > 0) {
                    updatedReactions[reaction]--;
                }

                const updatedMessage = await updateMessage(messageId, { reactions: updatedReactions });
                
                update(messages => messages.map(m => m.id === messageId ? updatedMessage : m));
                return updatedMessage;
            } catch (error) {
                console.error('Error removing reaction:', error);
                throw error;
            }
        }
    };
}

export const messagesStore = createMessagesStore();