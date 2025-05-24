import { writable, get } from 'svelte/store';
import type { Messages } from '$lib/types/types';
import {
	fetchMessagesForThread,
	addMessageToThread,
	fetchMessagesForBookmark,
	updateMessage
} from '$lib/clients/threadsClient';
import { threadsStore } from './threadsStore';
import { currentUser } from '$lib/pocketbase';

function createMessagesStore() {
	const store = writable<{
		messages: Messages[];
		currentThreadId: string | null;
		selectedDate: string | null;
	}>({
		messages: [],
		currentThreadId: null,
		selectedDate: null
	});

	let activeSubscriptions: Record<string, () => void> = {};

	const { subscribe, update } = store;

	return {
		subscribe,

		setSelectedDate: (date: string | null) => {
			update((state) => ({ ...state, selectedDate: date }));
		},

		setMessages: (messages: Messages[]) => {
			update((state) => ({ ...state, messages: messages || [] }));
		},

		addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>) => {
			try {
				const newMessage = await addMessageToThread(message);
				update((state) => ({
					...state,
					messages: [...state.messages, newMessage]
				}));

				if (message.thread) {
					threadsStore.update((state) => ({
						...state,
						threads: state.threads.map((thread) =>
							thread.id === message.thread
								? { ...thread, updated: new Date().toISOString() }
								: thread
						)
					}));
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
				update((state) => ({
					...state,
					messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...data } : msg))
				}));
				return updatedMessage;
			} catch (error) {
				console.error('Error updating message:', error);
				throw error;
			}
		},

		fetchMessages: async (threadId: string) => {
			try {
				const currentState = get(store);
				if (currentState.currentThreadId === threadId && currentState.messages.length > 0) {
					console.log('Skipping fetch - already have messages for this thread');
					return currentState.messages;
				}

				console.log(`Fetching messages for thread ${threadId}`);
				const messages = await fetchMessagesForThread(threadId);

				update((state) => ({
					...state,
					messages: messages || [],
					currentThreadId: threadId
				}));

				return messages;
			} catch (error) {
				console.error('Error fetching messages:', error);
				throw error;
			}
		},

		saveMessage: async (message: Partial<Messages>, threadId: string) => {
			try {
				const user = get(currentUser);
				if (!user || !user.id) {
					throw new Error('User not authenticated');
				}

				const tempId = message.tempId;

				let systemPromptText = null;
				if (user.sysprompt_preference) {
					if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
						const SYSTEM_PROMPTS = {
							NORMAL: 'Respond naturally and conversationally with balanced detail.',
							CONCISE: 'Provide brief responses focused on key information only.',
							CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
							INTERVIEW: 'Ask probing questions to gather more information.'
						};
						systemPromptText =
							SYSTEM_PROMPTS[user.sysprompt_preference as keyof typeof SYSTEM_PROMPTS];
					} else {
						try {
							const response = await fetch(`/api/prompts/${user.sysprompt_preference}`);
							if (response.ok) {
								const promptData = await response.json();
								systemPromptText = promptData.data?.prompt || promptData.prompt;
							}
						} catch (error) {
							console.error('Error fetching system prompt:', error);
						}
					}
				}

				let promptInput = null;
				if (user.prompt_preference) {
					let promptId: string | null = null;

					if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
						promptId = user.prompt_preference[0];
					} else if (typeof user.prompt_preference === 'string') {
						promptId = user.prompt_preference;
					}

					if (promptId) {
						try {
							const response = await fetch(`/api/prompts/${promptId}`);
							if (response.ok) {
								const promptData = await response.json();
								promptInput = promptData.data?.prompt || promptData.prompt;
							}
						} catch (error) {
							console.error('Error fetching user prompt:', error);
						}
					}
				}

				const newMessage: Omit<Messages, 'id' | 'created' | 'updated'> = {
					text: message.text || '',
					user: user.id,
					parent_msg: message.parent_msg || null,
					task_relation: message.task_relation || null,
					agent_relation: message.agent_relation || null,
					type: message.type || 'human',
					read_by: [user.id],
					thread: threadId,
					attachments: message.attachments || '',
					prompt_type: systemPromptText,
					prompt_input: promptInput,
					model: message.model || 'default'
				};

				const savedMessage = await addMessageToThread(newMessage);

				update((state) => {
					const existingMessageIndex = state.messages.findIndex(
						(m) => (tempId && m.tempId === tempId) || m.id === savedMessage.id
					);

					if (existingMessageIndex >= 0) {
						const updatedMessages = [...state.messages];
						updatedMessages[existingMessageIndex] = {
							...savedMessage,
							tempId
						};

						return {
							...state,
							messages: updatedMessages
						};
					} else {
						return {
							...state,
							messages: [
								...state.messages,
								{
									...savedMessage,
									tempId
								}
							]
						};
					}
				});

				return savedMessage;
			} catch (error) {
				console.error('Error saving message:', error);
				throw error;
			}
		},

		fetchBookmarkedMessages: async (messageId: string) => {
			try {
				const messages = await fetchMessagesForBookmark(messageId);
				update((state) => ({ ...state, messages: messages || [] }));
				return messages;
			} catch (error) {
				console.error('Error fetching bookmarked messages:', error);
				update((state) => ({ ...state, messages: [] }));
				throw error;
			}
		},

		cleanup: () => {
			Object.entries(activeSubscriptions).forEach(([threadId, unsub]) => {
				try {
					if (typeof unsub === 'function') {
						unsub();
					}
				} catch (err) {
					console.error(`Error during cleanup for thread ${threadId}:`, err);
				}
			});

			activeSubscriptions = {};

			update((state) => ({
				...state,
				currentThreadId: null,
				messages: []
			}));
		},

		clear: () => {
			Object.entries(activeSubscriptions).forEach(([threadId, unsub]) => {
				try {
					if (typeof unsub === 'function') {
						unsub();
					}
				} catch (err) {
					console.error(`Error during clear for thread ${threadId}:`, err);
				}
			});

			activeSubscriptions = {};

			update((state) => ({
				...state,
				messages: [],
				currentThreadId: null
			}));
		}
	};
}

export const messagesStore = createMessagesStore();
