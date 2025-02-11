import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
// import { fetchNamingResponse } from '$lib/clients/aiClient'
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { threadsStore } from '$lib/stores/threadsStore';
import { processMarkdown } from '$lib/scripts/markdownProcessor';

/** Utility to ensure user is authenticated */
export function ensureAuthenticated(): void {
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
			sort: '-created'
			// expand: 'user,parent_msg,task_relation,agent_relation,prompt_type,model'
		});

		// Process markdown for each message
		const processedMessages = messages.map((message) => ({
			...message,
			text: processMarkdown(message.text)
		}));

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

export async function fetchMessagesForThreadByDate(
	threadId: string,
	date?: Date
): Promise<Messages[]> {
	try {
		ensureAuthenticated();

		let filter = `thread = "${threadId}"`;

		if (date) {
			// Create date range for the selected date (start of day to end of day)
			const startDate = new Date(date);
			startDate.setHours(0, 0, 0, 0);

			const endDate = new Date(date);
			endDate.setHours(23, 59, 59, 999);

			filter += ` && created >= "${startDate.toISOString()}" && created <= "${endDate.toISOString()}"`;
		}

		const messages = await pb.collection('messages').getFullList<Messages>({
			filter: filter,
			sort: '-created'
			// expand: 'user,parent_msg,task_relation,agent_relation,prompt_type,model'
		});

		// Process markdown for each message
		const processedMessages = messages.map((message) => ({
			...message,
			text: processMarkdown(message.text)
		}));

		return processedMessages;
	} catch (error) {
		console.error('Error fetching messages for thread:', error);
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

		if (messages.length > 0) {
			const lastMessage = messages[0];
			return {
				...lastMessage,
				text: processMarkdown(lastMessage.text)
			};
		}
		return null;
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

		// Get current state BEFORE making API call
		const currentState = get(threadsStore);
		const showThreadList = currentState?.showThreadList ?? true;

		const resultList = await pb.collection('threads').getList<Threads>(1, 50, {
			sort: '-created',
			$cancelKey: 'threads'
			// Remove expand if not needed to reduce request complexity
		});

		if (!resultList?.items) {
			console.warn('No threads found or invalid response');
			// Return empty array but preserve visibility state
			return [];
		}

		// Map threads and explicitly preserve showThreadList state
		return resultList.items.map((thread) => ({
			...thread,
			showThreadList,
			// Ensure other critical properties exist
			tags: thread.tags || [],
			current_thread: thread.current_thread || ''
		}));
	} catch (error) {
		if (error instanceof ClientResponseError) {
			console.error('PocketBase Response Error:', {
				status: error.status,
				data: error.data,
				message: error.message,
				url: error.url
			});

			// On auth error, preserve current state instead of returning empty array
			if (error.status === 401) {
				const currentState = get(threadsStore);
				return currentState.threads || [];
			}
		}

		// For other errors, preserve existing threads
		const currentState = get(threadsStore);
		return currentState.threads || [];
	}
}

export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
	try {
		ensureAuthenticated();
		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw new Error('User ID not found');
		}

		// Create base thread data with explicit empty values
		const newThread: Partial<Threads> = {
			name: threadData.name || 'New Thread',
			op: userId,
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			tags: [],
			current_thread: '',
			// Add any showThreadList state property if it exists in your Threads type
			...(threadData.project_id && { project_id: threadData.project_id })
		};

		console.log('Creating thread with data:', newThread);

		let createdThread: Threads | null = null;

		try {
			createdThread = await pb.collection('threads').create<Threads>(newThread);
			console.log('Thread created:', createdThread);

			// If project_id exists, update project
			if (createdThread.project_id) {
				try {
					const project = await pb
						.collection('projects')
						.getOne<Projects>(createdThread.project_id);
					const updatedThreads = Array.isArray(project.threads)
						? [...project.threads, createdThread.id]
						: [createdThread.id];

					await pb.collection('projects').update(createdThread.project_id, {
						threads: updatedThreads
					});
					console.log('Project updated with new thread');
				} catch (error) {
					console.error('Project update failed:', error);
					// Cleanup created thread if project update fails
					if (createdThread?.id) {
						await pb.collection('threads').delete(createdThread.id);
					}
					throw error;
				}
			}

			// Return the thread with explicit visibility state
			return {
				...createdThread,
				// Keep any existing visibility state from threadData
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
			console.error('PocketBase details:', {
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
		ensureAuthenticated();

		// Process markdown if text is being updated
		const processedData = data.text
			? {
					...data,
					text: processMarkdown(data.text)
				}
			: data;

		return await pb.collection('messages').update<Messages>(id, processedData);
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

		// Get current thread state before update
		const currentThread = await pb.collection('threads').getOne<Threads>(id);

		const updatedChanges = {
			...changes,
			// Preserve showThreadList state if it exists
			...(currentThread.showThreadList !== undefined && {
				showThreadList: currentThread.showThreadList
			})
		};

		const updatedThread = await pb.collection('threads').update<Threads>(id, updatedChanges);

		console.log('Thread updated successfully:', updatedThread);
		return updatedThread;
	} catch (error) {
		console.error('Thread update failed:', error);
		if (error instanceof ClientResponseError) {
			console.error('Response details:', {
				status: error.status,
				data: error.data
			});
		}
		throw error;
	}
}

export async function autoUpdateThreadName(
	threadId: string,
	messages: Messages[],
	model: AIModel,
	userId: string
): Promise<Threads | null> {
	try {
		ensureAuthenticated();

		// Call updateThreadNameIfNeeded but don't use its return value
		await updateThreadNameIfNeeded(threadId, messages, model, userId);

		// Fetch and return the updated thread directly
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
		ensureAuthenticated();

		console.log('Attempting to add message:', JSON.stringify(message, null, 2));
		console.log('User ID:', pb.authStore.model?.id);

		// Process markdown before saving
		const processedMessage = {
			...message,
			text: processMarkdown(message.text)
		};

		const createdMessage = await pb.collection('messages').create<Messages>(processedMessage);
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

export async function fetchMessagesForBookmark(bookmarkId: string): Promise<Messages[]> {
	try {
		ensureAuthenticated();
		console.log(`Attempting to fetch bookmarked messages: ${bookmarkId}`);

		const messages = await pb.collection('messages').getFullList<Messages>({
			filter: `id = "${bookmarkId}"`,
			sort: '-created'
			// expand: 'user,parent_msg,task_relation,agent_relation,prompt_type,model'
		});

		const processedMessages = messages.map((message) => ({
			...message,
			text: processMarkdown(message.text)
		}));

		console.log(`Fetched ${processedMessages.length} messages for bookmark ${bookmarkId}`);
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
