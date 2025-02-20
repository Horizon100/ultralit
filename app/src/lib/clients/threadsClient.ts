import { get } from 'svelte/store';
import type { Messages, Threads, AIModel, Projects } from '$lib/types/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { updateThreadNameIfNeeded } from '$lib/utils/threadNaming';
import { threadsStore } from '$lib/stores/threadsStore';
import { processMarkdown } from '$lib/scripts/markdownProcessor';

export function ensureAuthenticated(): void {
	if (!pb.authStore.isValid) {
		throw new Error('User is not authenticated');
	}
}
export async function fetchThreads(): Promise<Threads[]> {
	try {
		ensureAuthenticated();
		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw new Error('User ID not found');
		}
		const currentState = get(threadsStore);
		const showThreadList = currentState?.showThreadList ?? true;

		const resultList = await pb.collection('threads').getList<Threads>(1, 50, {
			sort: '-created',
			$cancelKey: 'threads'
		});

		if (!resultList?.items) {
			console.warn('No threads found or invalid response');
			return [];
		}

		return resultList.items.map((thread) => ({
			...thread,
			showThreadList,
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
		ensureAuthenticated();
		console.log(`Attempting to fetch messages for thread: ${threadId}`);

		const messages = await pb.collection('messages').getFullList<Messages>({
			filter: `thread = "${threadId}"`,
			sort: '-created'
		});

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
export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
	try {
		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw new Error('User ID not found');
		}

		console.log('Received threadData:', threadData);
		console.log('threadData.project_id:', threadData.project_id);

		const newThread: Partial<Threads> = {
			name: threadData.name || 'New Thread',
			op: userId,
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			tags: [],
			current_thread: '',
			project_id: threadData.project_id
		};

		console.log('Creating thread with data:', newThread);

		let createdThread: Threads | null = null;

		try {
			ensureAuthenticated();
			createdThread = await pb.collection('threads').create<Threads>(newThread);
			console.log('Thread created:', createdThread);
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
		ensureAuthenticated();

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

        const currentThread = await pb.collection('threads').getOne<Threads>(id);

        const updatedChanges = {
            ...changes,
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
		ensureAuthenticated();

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
		ensureAuthenticated();

		console.log('Attempting to add message:', JSON.stringify(message, null, 2));
		console.log('User ID:', pb.authStore.model?.id);

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
