import { get } from 'svelte/store';
import type { Messages, Threads, AIModel } from '$lib/types/types';
import { currentUser, getUserById } from '$lib/pocketbase';
import { processMarkdown } from '$lib/features/ai/utils/markdownProcessor';
import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
import { updateThreadNameIfNeeded } from '$lib/features/threads/utils/threadNaming';
import {
	fetchTryCatch,
	validationTryCatch,
	isFailure,
	clientTryCatch,
	isSuccess,
	type Result
} from '$lib/utils/errorUtils';

let isLoadingAllThreads = false;
let lastThreadLoadTime = 0;

const CACHE_DURATION = 10000;

const messageCache = new Map<
	string,
	{
		messages: Messages[];
		timestamp: number;
	}
>();
class ClientFetchManager {
	private static pendingFetches = new Map<string, Promise<Messages[]>>();

	static async debouncedFetchMessages(threadId: string): Promise<Messages[]> {
		const existingRequest = this.pendingFetches.get(threadId);
		if (existingRequest) {
			console.log(`Prevented recursive fetch for thread ${threadId}`);
			return await existingRequest;
		}

		const requestPromise = this.executeFetch(threadId);
		this.pendingFetches.set(threadId, requestPromise);

		try {
			return await requestPromise;
		} finally {
			this.pendingFetches.delete(threadId);
		}
	}

	private static async executeFetch(threadId: string): Promise<Messages[]> {
		// Your existing fetchMessagesForThread implementation here
		// Move the actual fetch logic into this method
	}
}
// Thread list visibility functions
export function isThreadListVisible(): boolean {
	return get(showThreadList);
}

export function toggleThreadList(): void {
	threadsStore.toggleThreadList();
}

export function setThreadListVisibility(visible: boolean): void {
	threadsStore.setThreadListVisibility(visible);
}

// Export a consistent interface for thread list visibility management
export const threadListVisibility = {
	get: isThreadListVisible,
	set: setThreadListVisibility,
	toggle: toggleThreadList
};

/**
 * Fetch threads for a project from the API
 * @param projectId Project ID
 * @returns Promise with thread array
 */
export async function fetchProjectThreads(projectId: string): Promise<Threads[]> {
	const result = await fetchThreads(projectId);
	return result.success ? result.data : [];
}

/**
 * Fetch unassigned threads (not belonging to any project)
 * @returns Promise with thread array (empty array on error)
 */
export async function fetchUnassignedThreads(): Promise<Threads[]> {
	const result = await fetchThreads(null);
	return result.success ? result.data : [];
}
function validateAuthentication() {
	return validationTryCatch(() => {
		const user = get(currentUser);
		if (!user) {
			throw new Error('User not authenticated');
		}
		return user;
	}, 'user authentication');
}

export async function fetchThreads(
	projectId: string | null = null
): Promise<Result<Threads[], string>> {
	const user = get(currentUser);

	if (!user?.token) {
		console.warn('No user token found, but continuing with request');
	}

	// Build the URL with project parameter if provided
	let url = '/api/threads';
	if (projectId) {
		url = `${url}?project=${projectId}`;
	}

	console.log(`Fetching threads from ${url}`);

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	// Add authorization header if we have a token
	if (user?.token) {
		headers['Authorization'] = `Bearer ${user.token}`;
	}

	const result = await fetchTryCatch<{ threads?: Threads[]; error?: string }>(url, {
		method: 'GET',
		credentials: 'include',
		headers
	});

	if (isFailure(result)) {
		console.error('Error fetching threads:', result.error);
		return { data: null, error: result.error, success: false };
	}

	const threads = result.data.threads || [];
	console.log(`Received ${threads.length} threads from API`);
	return { data: threads, error: null, success: true };
}

export async function fetchAllThreads(): Promise<Result<Threads[], string>> {
	const user = get(currentUser);

	if (!user?.token) {
		console.warn('No user token found, but continuing with request');
	}

	const url = '/api/threads?all=true';
	console.log(`Fetching all threads from ${url}`);

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (user?.token) {
		headers['Authorization'] = `Bearer ${user.token}`;
	}

	const result = await fetchTryCatch<{ threads?: Threads[]; error?: string }>(url, {
		method: 'GET',
		credentials: 'include',
		headers
	});

	if (isFailure(result)) {
		console.error('Error fetching all threads:', result.error);
		return { data: null, error: result.error, success: false };
	}

	const threads = result.data.threads || [];
	console.log(`Received ${threads.length} total threads from API`);
	return { data: threads, error: null, success: true };
}

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
	console.log(`🔍 threadsClient.fetchMessagesForThread: Starting fetch for thread ${threadId}`);

	try {
		const response = await fetch(`/api/keys/threads/${threadId}/messages`, {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		console.log(`🔍 threadsClient.fetchMessagesForThread: Response status:`, response.status);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		console.log(`🔍 threadsClient.fetchMessagesForThread: Response data:`, data);

		if (data.success) {
			const messages = data.messages || [];
			console.log(`🔍 threadsClient.fetchMessagesForThread: Returning ${messages.length} messages`);
			return messages;
		} else {
			throw new Error(data.error || 'Failed to fetch messages');
		}
	} catch (error) {
		console.error(`🔍 threadsClient.fetchMessagesForThread: Error:`, error);
		throw error;
	}
}

export async function resetThread(threadId: string): Promise<Result<void, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const idValidation = validationTryCatch(() => {
		if (!threadId) {
			throw new Error('Thread ID is required');
		}
		return threadId;
	}, 'thread ID validation');

	if (isFailure(idValidation)) {
		return { data: null, error: idValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success?: boolean; error?: string }>(
		`/api/keys/threads/${threadId}`,
		{
			method: 'PATCH',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ selected: false })
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	console.log('Thread reset successfully');
	return { data: undefined, error: null, success: true };
}

export async function deleteThread(id: string): Promise<Result<boolean, string>> {
	const result = await fetchTryCatch<{
		success: boolean;
		error?: string;
	}>(`/api/keys/threads/${id}`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to delete thread', success: false };
	}

	return { data: true, error: null, success: true };
}

function invalidateThreadCache(threadId: string) {
	messageCache.delete(threadId);
}

const isFetching = false;

// Function to get the current thread state
export function getCurrentThread(): Threads | null {
	const state = get(threadsStore);
	return state.currentThread;
}

// Function to set the current thread
export function setCurrentThread(threadId: string | null): void {
	threadsStore.setCurrentThread(threadId);
}

export async function createThread(threadData: Partial<Threads>): Promise<Result<Threads, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const user = authValidation.data;
	const projectId = threadData.project_id || threadData.project;

	const newThread: Partial<Threads> = {
		name: threadData.name || 'New Thread',
		op: user.id,
		user: user.id,
		members: threadData.members || [user.id],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		tags: threadData.tags || [],
		current_thread: '',
		...(projectId ? { project: projectId, project_id: projectId } : {})
	};

	const result = await fetchTryCatch<{
		success: boolean;
		thread?: Threads;
		message?: string;
	}>('/api/threads', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${user.token}`
		},
		body: JSON.stringify(newThread)
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.message || 'Failed to create thread', success: false };
	}

	// Validate that thread exists in response
	if (!result.data.thread) {
		return { data: null, error: 'No thread returned from server', success: false };
	}

	const createdThread = {
		...result.data.thread,
		project_id: projectId || result.data.thread.project_id
	};

	return { data: createdThread, error: null, success: true };
}

export async function updateMessage(
	id: string,
	data: Partial<Messages>
): Promise<Result<Messages, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	// Fix: await processMarkdown if it returns a Promise
	const processedData = data.text
		? {
				...data,
				text: await processMarkdown(data.text)
			}
		: data;

	const result = await fetchTryCatch<{
		success: boolean;
		message?: Messages;
		error?: string;
	}>(`/api/keys/messages/${id}`, {
		method: 'PATCH',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(processedData)
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to update message', success: false };
	}

	// Validate that message exists in response
	if (!result.data.message) {
		return { data: null, error: 'No message returned from server', success: false };
	}

	const updatedMessage = result.data.message;

	if (updatedMessage.thread) {
		invalidateThreadCache(updatedMessage.thread);
	}

	return { data: updatedMessage, error: null, success: true };
}

export async function updateThread(
	id: string,
	changes: Partial<Threads>
): Promise<Result<Threads, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const user = authValidation.data;

	if (changes.project_id || changes.project) {
		const projectId = changes.project_id || changes.project;
		if (projectId !== null) {
			changes = {
				...changes,
				project: projectId,
				project_id: projectId
			};
		}
	}

	const result = await fetchTryCatch<{
		success: boolean;
		thread?: Threads;
		message?: string;
	}>(`/api/threads/${id}`, {
		method: 'PATCH',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${user.token}`
		},
		body: JSON.stringify(changes)
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.message || 'Failed to update thread', success: false };
	}

	// Validate that thread exists in response
	if (!result.data.thread) {
		return { data: null, error: 'No thread returned from server', success: false };
	}

	const updatedThread = result.data.thread;

	// Update store
	threadsStore.update((state) => ({
		...state,
		threads: state.threads.map((t) => (t.id === id ? updatedThread : t))
	}));

	return { data: updatedThread, error: null, success: true };
}

export async function loadThreads(projectId: string | null): Promise<Result<void, string>> {
	const now = Date.now();
	// Throttle repeated calls to prevent hammering the API
	if (isLoadingAllThreads || now - lastThreadLoadTime < 2000) {
		console.log('Skipping thread reload due to throttling');
		return { data: undefined, error: null, success: true };
	}

	isLoadingAllThreads = true;

	const loadOperation = await clientTryCatch(
		(async () => {
			// Set loading state
			threadsStore.update((state) => ({
				...state,
				isLoading: true,
				error: null
			}));

			console.log(`Loading threads for ${projectId ? `project ${projectId}` : 'all projects'}`);

			// Fetch threads from API based on projectId
			let threadsResult: Result<Threads[], string>;

			if (projectId) {
				threadsResult = await fetchThreads(projectId);
			} else {
				threadsResult = await fetchAllThreads();
			}

			if (isFailure(threadsResult)) {
				threadsStore.update((state) => ({
					...state,
					isLoading: false,
					error: threadsResult.error,
					updateStatus: 'Failed to load threads'
				}));
				throw new Error(threadsResult.error);
			}

			const threads = threadsResult.data;
			console.log(`Successfully loaded ${threads.length} threads`);

			// Ensure project_id is consistently set on all threads
			const processedThreads = threads.map((thread) => ({
				...thread,
				project_id: thread.project_id || thread.project || null
			}));

			// Update the store with all threads
			threadsStore.update((state) => ({
				...state,
				threads: processedThreads,
				filteredThreads: processedThreads,
				isThreadsLoaded: true,
				isLoading: false,
				project_id: projectId,
				updateStatus: 'Threads loaded successfully',
				error: null
			}));

			lastThreadLoadTime = now;
		})(),
		'Loading threads'
	);

	// Always clean up the loading flag
	isLoadingAllThreads = false;

	if (isFailure(loadOperation)) {
		console.error('Error in loadThreads:', loadOperation.error);

		threadsStore.update((state) => ({
			...state,
			isLoading: false,
			error: loadOperation.error,
			updateStatus: 'Failed to load threads'
		}));

		return { data: null, error: loadOperation.error, success: false };
	}

	return { data: undefined, error: null, success: true };
}

export async function addMessageToThread(
	message: Omit<Messages, 'id' | 'created' | 'updated'>
): Promise<Result<Messages, string>> {
	// Validate authentication
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	let user = authValidation.data;

	// Check if we need fresh user data
	if (!user || (!user.sysprompt_preference && !user.prompt_preference)) {
		console.log('Fetching fresh user data...');
		if (user?.id) {
			const userResult = await clientTryCatch(
				getUserById(user.id, true),
				'Fetching fresh user data'
			);

			if (isSuccess(userResult) && userResult.data) {
				currentUser.set(userResult.data);
				user = userResult.data;
			}
		}
	}

	console.log('User sysprompt_preference:', user?.sysprompt_preference);
	console.log('User prompt_preference:', user?.prompt_preference);

	const processedMessage = { ...message };

	// Process system prompts
	if (user) {
		if (user.sysprompt_preference) {
			if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
				const SYSTEM_PROMPTS = {
					NORMAL: 'Respond naturally and conversationally with balanced detail.',
					CONCISE: 'Provide brief responses focused on key information only.',
					CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
					INTERVIEW: 'Ask probing questions to gather more information.'
				};
				processedMessage.prompt_type =
					SYSTEM_PROMPTS[user.sysprompt_preference as keyof typeof SYSTEM_PROMPTS];
			}
		}

		// Process user prompt preference
		if (user.prompt_preference) {
			let promptId: string | null = null;

			if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
				promptId = user.prompt_preference[0];
			} else if (typeof user.prompt_preference === 'string') {
				promptId = user.prompt_preference;
			}

			if (promptId) {
				const promptResult = await fetchTryCatch<{
					data?: { prompt?: string };
					prompt?: string;
				}>(`/api/prompts/${promptId}`);

				if (isSuccess(promptResult)) {
					console.log('Prompt fetch data:', promptResult.data);
					processedMessage.prompt_input =
						promptResult.data.data?.prompt || promptResult.data.prompt;
					console.log('Set prompt_input to:', processedMessage.prompt_input);
				} else {
					console.log('Prompt fetch failed:', promptResult.error);
				}
			}
		}
	}

	console.log('Attempting to add message:', JSON.stringify(processedMessage, null, 2));

	// Create the message - Fixed: removed duplicate 'message' property
	const messageResult = await fetchTryCatch<{
		success: boolean;
		message?: Messages;
		error?: string; // Changed from 'message' to 'error' to avoid duplicate
	}>('/api/keys/messages', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${user?.token || ''}`
		},
		body: JSON.stringify(processedMessage)
	});

	if (isFailure(messageResult)) {
		return { data: null, error: messageResult.error, success: false };
	}

	console.log('API response:', messageResult.data);

	if (!messageResult.data.success) {
		return {
			data: null,
			error: messageResult.data.error || 'Failed to create message',
			success: false
		};
	}

	const createdMessage = messageResult.data.message;
	if (!createdMessage || !createdMessage.id) {
		return { data: null, error: 'API returned invalid message without ID', success: false };
	}

	console.log('Created message:', createdMessage);

	// Update thread timestamp if needed
	if (message.thread) {
		const threadUpdateResult = await fetchTryCatch(`/api/threads/${message.thread}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${user?.token || ''}`
			},
			body: JSON.stringify({
				updated: new Date().toISOString()
			})
		});

		if (isSuccess(threadUpdateResult)) {
			console.log(`Updated thread ${message.thread} timestamp successfully`);
		} else {
			console.error('Error updating thread timestamp:', threadUpdateResult.error);
		}
	}

	return { data: createdMessage, error: null, success: true };
}
export function setupMessageListener(threadId: string, onNewMessage: () => void): () => void {
	const setupResult = validationTryCatch(() => {
		// Validate inputs
		if (!threadId) {
			throw new Error('Thread ID is required');
		}
		if (!onNewMessage) {
			throw new Error('Callback function is required');
		}

		// Set up polling instead of websocket subscription
		const pollInterval = 3000; // Poll every 3 seconds

		console.log(`Setting up polling for thread ${threadId}`);

		const intervalId = setInterval(async () => {
			const pollResult = await fetchTryCatch(`/api/keys/threads/${threadId}/messages`, {
				method: 'GET',
				credentials: 'include'
			});

			if (isSuccess(pollResult)) {
				// Invalidate cache to force refresh
				invalidateThreadCache(threadId);
				// Call the callback to refresh UI
				onNewMessage();
			} else {
				console.error('Error polling for messages:', pollResult.error);
			}
		}, pollInterval);

		return () => {
			clearInterval(intervalId);
			console.log(`Cleaned up polling for thread ${threadId}`);
		};
	}, 'message listener setup');

	if (isSuccess(setupResult)) {
		return setupResult.data;
	} else {
		console.error('Error setting up message listener:', setupResult.error);
		return () => {}; // Return dummy cleanup function
	}
}

export async function autoUpdateThreadName(
	threadId: string,
	messages: Messages[],
	model: AIModel,
	userId: string
): Promise<Result<Threads | null, string>> {
	// First check if thread exists in the store
	const existingThreads = get(threadsStore).threads;
	const threadExists = existingThreads.some((t) => t.id === threadId);

	if (!threadExists) {
		console.log(`Thread ${threadId} not found in store, fetching before naming`);

		const threadFetchResult = await fetchTryCatch<{
			success: boolean;
			thread?: Threads;
			message?: string;
		}>(`/api/keys/threads/${threadId}`, {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${get(currentUser)?.token || ''}`
			}
		});

		if (
			isSuccess(threadFetchResult) &&
			threadFetchResult.data.success &&
			threadFetchResult.data.thread
		) {
			// Validate that thread exists before using it
			const fetchedThread = threadFetchResult.data.thread;
			if (fetchedThread) {
				// Add thread to store
				threadsStore.update((state) => ({
					...state,
					threads: [fetchedThread, ...state.threads.filter((t) => t.id !== threadId)]
				}));
				console.log(`Added thread ${threadId} to store`);
			}
		} else {
			const errorMessage = isFailure(threadFetchResult)
				? threadFetchResult.error
				: 'Thread not found';
			console.error('Error fetching thread before naming:', errorMessage);
		}
	}

	// Update the thread name
	const updateResult = await clientTryCatch(
		updateThreadNameIfNeeded(threadId, messages, model, userId),
		'Updating thread name'
	);

	if (isFailure(updateResult)) {
		console.error('Error updating thread name:', updateResult.error);
	}

	// Get the updated thread
	const updatedThreadResult = await fetchTryCatch<{
		success: boolean;
		thread?: Threads;
		message?: string;
	}>(`/api/keys/threads/${threadId}`, {
		method: 'GET',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${get(currentUser)?.token || ''}`
		}
	});

	if (isFailure(updatedThreadResult)) {
		return { data: null, error: updatedThreadResult.error, success: false };
	}

	if (!updatedThreadResult.data.success) {
		return {
			data: null,
			error: updatedThreadResult.data.message || 'Failed to fetch updated thread',
			success: false
		};
	}

	// Update the thread in the store to ensure consistency
	const updatedThread = updatedThreadResult.data.thread;
	if (updatedThread) {
		threadsStore.update((state) => ({
			...state,
			threads: state.threads.map((t) => (t.id === threadId ? updatedThread : t))
		}));
	}

	return { data: updatedThread || null, error: null, success: true };
}

export async function fetchMessagesForBookmark(
	bookmarkId: string
): Promise<Result<Messages[], string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const user = authValidation.data;
	console.log(`Attempting to fetch bookmarked messages: ${bookmarkId}`);

	const result = await fetchTryCatch<{
		success: boolean;
		messages?: Messages[];
		message?: string;
	}>(`/api/bookmarks/${bookmarkId}/messages`, {
		method: 'GET',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${user.token || ''}`
		}
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.message || 'Failed to fetch bookmarked messages',
			success: false
		};
	}

	const messages = result.data.messages || [];
	// Fix: await processMarkdown if it returns a Promise
	const processedMessages = await Promise.all(
		messages.map(async (message: Messages) => ({
			...message,
			text: await processMarkdown(message.text)
		}))
	);

	console.log(`Fetched ${processedMessages.length} messages for bookmark ${bookmarkId}`);
	return { data: processedMessages, error: null, success: true };
}
