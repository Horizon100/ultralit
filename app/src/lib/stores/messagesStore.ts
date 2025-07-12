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
import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';

// Add this class at the top of messagesStore.ts, before createMessagesStore()
class MessagesFetchManager {
	private static fetchingThreads = new Set<string>();

	static async safeFetchMessages(threadId: string): Promise<Messages[]> {
		if (this.fetchingThreads.has(threadId)) {
			throw new Error('Fetch already in progress');
		}

		this.fetchingThreads.add(threadId);
		try {
			console.log(`Fetching messages for thread ${threadId}`);
			const fetchResult = await fetchMessagesForThread(threadId);

			// Handle if fetchMessagesForThread returns a Result type
			let messages: Messages[];
			if (
				fetchResult &&
				typeof fetchResult === 'object' &&
				'success' in fetchResult &&
				'data' in fetchResult &&
				'error' in fetchResult &&
				typeof (fetchResult as { success: unknown }).success === 'boolean'
			) {
				// This is a Result type
				const resultType = fetchResult as {
					success: boolean;
					data: Messages[];
					error: unknown;
				};
				if (!resultType.success) {
					throw new Error(String(resultType.error));
				}
				messages = resultType.data;
			} else {
				// This is the actual data
				messages = fetchResult as unknown as Messages[];
			}

			return messages || [];
		} finally {
			this.fetchingThreads.delete(threadId);
		}
	}
}

function createMessagesStore() {
	const store = writable<{
		messages: Messages[];
		currentThreadId: string | null;
		selectedDate: string | null;
		loading: boolean;
	}>({
		messages: [],
		currentThreadId: null,
		selectedDate: null,
		loading: false
	});

	let activeSubscriptions: Record<string, () => void> = {};

	const { subscribe, update } = store;

	return {
		subscribe,
		setLoading: (loading: boolean) => {
			update((state) => ({ ...state, loading }));
		},
		setSelectedDate: (date: string | null) => {
			update((state) => ({ ...state, selectedDate: date }));
		},

		setMessages: (messages: Messages[]) => {
			update((state) => ({ ...state, messages: messages || [] }));
		},

		addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>) => {
			const result = await clientTryCatch(
				(async () => {
					const addResult = await addMessageToThread(message);

					// Handle if addMessageToThread returns a Result type
					let newMessage: Messages;
					if (
						addResult &&
						typeof addResult === 'object' &&
						'success' in addResult &&
						'data' in addResult &&
						'error' in addResult &&
						typeof (addResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = addResult as { success: boolean; data: Messages; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						newMessage = resultType.data;
					} else {
						// This is the actual data
						newMessage = addResult as unknown as Messages;
					}

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
				})(),
				'Adding message to thread'
			);

			if (isFailure(result)) {
				console.error('Error adding message:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		updateMessage: async (id: string, data: Partial<Messages>) => {
			const result = await clientTryCatch(
				(async () => {
					const updateResult = await updateMessage(id, data);

					// Handle if updateMessage returns a Result type
					let updatedMessage: Messages;
					if (
						updateResult &&
						typeof updateResult === 'object' &&
						'success' in updateResult &&
						'data' in updateResult &&
						'error' in updateResult &&
						typeof (updateResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = updateResult as { success: boolean; data: Messages; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						updatedMessage = resultType.data;
					} else {
						// This is the actual data
						updatedMessage = updateResult as unknown as Messages;
					}

					update((state) => ({
						...state,
						messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...data } : msg))
					}));
					return updatedMessage;
				})(),
				`Updating message ${id}`
			);

			if (isFailure(result)) {
				console.error('Error updating message:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		fetchMessages: async (threadId: string) => {
			const result = await clientTryCatch(
				(async () => {
					const currentState = get(store);

					// Only skip if we actually have messages AND it's the same thread
					if (
						currentState.currentThreadId === threadId &&
						currentState.messages.length > 0 &&
						!currentState.loading
					) {
						console.log('Skipping fetch - already have messages for this thread');
						return currentState.messages;
					}

					// ALWAYS fetch fresh messages when switching threads
					console.log(`Fetching messages for thread ${threadId}`);

					// Set loading state immediately
					update((state) => ({ ...state, loading: true, currentThreadId: threadId }));

					const messages = await MessagesFetchManager.safeFetchMessages(threadId);

					update((state) => ({
						...state,
						messages: messages || [],
						currentThreadId: threadId,
						loading: false
					}));

					return messages;
				})(),
				`Fetching messages for thread ${threadId}`
			);

			if (isFailure(result)) {
				update((state) => ({ ...state, loading: false }));
				console.error('Error fetching messages:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		saveMessage: async (message: Partial<Messages>, threadId: string) => {
			const result = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user || !user.id) {
						throw new Error('User not authenticated');
					}

					const tempId = message.tempId;

					let systemPromptText = null;
					if (user.sysprompt_preference) {
						if (
							['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)
						) {
							const SYSTEM_PROMPTS = {
								NORMAL: 'Respond naturally and conversationally with balanced detail.',
								CONCISE: 'Provide brief responses focused on key information only.',
								CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
								INTERVIEW: 'Ask probing questions to gather more information.'
							};
							systemPromptText =
								SYSTEM_PROMPTS[user.sysprompt_preference as keyof typeof SYSTEM_PROMPTS];
						} else {
							const promptResult = await clientTryCatch(
								(async () => {
									const fetchResult = await fetchTryCatch<{
										data?: { prompt?: string };
										prompt?: string;
									}>(`/api/prompts/${user.sysprompt_preference}`, { method: 'GET' });

									if (isFailure(fetchResult)) {
										throw new Error(`Failed to fetch system prompt: ${fetchResult.error}`);
									}

									const promptData = fetchResult.data;
									return promptData.data?.prompt || promptData.prompt;
								})(),
								`Fetching system prompt ${user.sysprompt_preference}`
							);

							if (!isFailure(promptResult)) {
								systemPromptText = promptResult.data;
							} else {
								console.error('Error fetching system prompt:', promptResult.error);
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
							const promptResult = await clientTryCatch(
								(async () => {
									const fetchResult = await fetchTryCatch<{
										data?: { prompt?: string };
										prompt?: string;
									}>(`/api/prompts/${promptId}`, { method: 'GET' });

									if (isFailure(fetchResult)) {
										throw new Error(`Failed to fetch user prompt: ${fetchResult.error}`);
									}

									const promptData = fetchResult.data;
									return promptData.data?.prompt || promptData.prompt;
								})(),
								`Fetching user prompt ${promptId}`
							);

							if (!isFailure(promptResult)) {
								promptInput = promptResult.data;
							} else {
								console.error('Error fetching user prompt:', promptResult.error);
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

					const addResult = await addMessageToThread(newMessage);

					// Handle if addMessageToThread returns a Result type
					let savedMessage: Messages;
					if (
						addResult &&
						typeof addResult === 'object' &&
						'success' in addResult &&
						'data' in addResult &&
						'error' in addResult &&
						typeof (addResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = addResult as { success: boolean; data: Messages; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						savedMessage = resultType.data;
					} else {
						// This is the actual data
						savedMessage = addResult as unknown as Messages;
					}
					update((state) => {
						const existingMessageIndex = state.messages.findIndex(
							(m) =>
								(tempId && (m as Messages & { tempId?: string }).tempId === tempId) ||
								m.id === savedMessage.id
						);

						if (existingMessageIndex >= 0) {
							const updatedMessages = [...state.messages];
							updatedMessages[existingMessageIndex] = {
								...savedMessage,
								tempId
							} as Messages & { tempId?: string };

							return {
								...state,
								messages: updatedMessages as Messages[]
							};
						} else {
							return {
								...state,
								messages: [
									...state.messages,
									{
										...savedMessage,
										tempId
									} as Messages & { tempId?: string }
								] as Messages[]
							};
						}
					});

					return savedMessage;
				})(),
				`Saving message to thread ${threadId}`
			);

			if (isFailure(result)) {
				console.error('Error saving message:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		fetchBookmarkedMessages: async (messageId: string) => {
			const result = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchMessagesForBookmark(messageId);

					// Handle if fetchMessagesForBookmark returns a Result type
					let messages: Messages[];
					if (
						fetchResult &&
						typeof fetchResult === 'object' &&
						'success' in fetchResult &&
						'data' in fetchResult &&
						'error' in fetchResult &&
						typeof (fetchResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = fetchResult as {
							success: boolean;
							data: Messages[];
							error: unknown;
						};
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						messages = resultType.data;
					} else {
						// This is the actual data
						messages = fetchResult as unknown as Messages[];
					}

					update((state) => ({ ...state, messages: messages || [] }));
					return messages;
				})(),
				`Fetching bookmarked messages for ${messageId}`
			);

			if (isFailure(result)) {
				console.error('Error fetching bookmarked messages:', result.error);
				update((state) => ({ ...state, messages: [] }));
				throw new Error(result.error);
			}

			return result.data;
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
