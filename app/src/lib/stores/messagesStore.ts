import { writable } from 'svelte/store';
import type { Messages } from '$lib/types/types';
import { pb } from '$lib/pocketbase';
import { fetchMessagesForThread, addMessageToThread, fetchMessagesForBookmark, updateMessage} from '$lib/clients/threadsClient';
import { threadsStore } from './threadsStore';
function createMessagesStore() {
	
	const { subscribe, set, update } = writable<Messages[]>([]);

	return {
		subscribe,
		setSelectedDate: (date: string | null) => {
			update((state) => ({ ...state, selectedDate: date }));
		},
		setMessages: (messages: Messages[]) => set(messages || []), 
		addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>) => {
			try {
				const newMessage = await addMessageToThread(message);
				update((messages) => (Array.isArray(messages) ? [...messages, newMessage] : [newMessage]));
				if (message.thread) {
					threadsStore.loadThreads();
				}
				return newMessage;
			} catch (error) {
				console.error('Error adding message:', error);
				throw error;
			}
		},
		updateMessage: async (id: string, data: Partial<Messages>) => {
			try {
				const updatedMessage = await updateMessage(id, data);
				update((messages) => 
					messages.map(msg => msg.id === id ? { ...msg, ...data } : msg)
				);
				return updatedMessage;
			} catch (error) {
				console.error('Error updating message:', error);
				throw error;
			}
		},
		fetchMessages: async (threadId: string) => {
			try {
				const messages = await fetchMessagesForThread(threadId);
				set(messages || []); 
				return messages;
			} catch (error) {
				console.error('Error fetching messages:', error);
				set([]); 
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
					prompt_type: message.prompt_type || null,
					model: message.model || 'fail'
				};

				const savedMessage = await addMessageToThread(newMessage);
				update((currentMessages) => {
					if (!Array.isArray(currentMessages)) {
						return [savedMessage];
					}
					return [...currentMessages, savedMessage];
				});
				threadsStore.loadThreads();

				return savedMessage;
			} catch (error) {
				console.error('Error saving message:', error);
				throw error;
			}
		},
		fetchBookmarkedMessages: async (messageId: string) => {
			try {
				const messages = await fetchMessagesForBookmark(messageId);
				set(messages || []); 
				return messages;
			} catch (error) {
				console.error('Error fetching messages:', error);
				set([]); 
				throw error;
			}
		},
		clear: () => set([])
	};
}

export const messagesStore = createMessagesStore();
