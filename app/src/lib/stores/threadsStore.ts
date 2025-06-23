// lib/stores/threadsStore.ts
import { writable, derived, get } from 'svelte/store';
import { ensureAuthenticated, currentUser } from '$lib/pocketbase';
import type { Messages, Threads, AIModel, ThreadStoreState, User } from '$lib/types/types';
import {
	fetchMessagesForThread,
	createThread,
	addMessageToThread,
	autoUpdateThreadName
} from '$lib/clients/threadsClient';
import { fetchThreadsForProject } from '$lib/clients/projectClient';
import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';

import { browser } from '$app/environment';
import {
	ArrowDown,
	CalendarDays,
	MessageSquare,
	SortAsc,
	SortDesc,
	User as UserIcon,
	UserCircle
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';
import type { SvelteComponent } from 'svelte';
import type { IconProps } from 'lucide-svelte';
type LucideIcon = ComponentType<SvelteComponent<IconProps>>;
export interface SortOptionInfo {
	value: ThreadSortOption;
	label: string;
	icon: LucideIcon;
}
export enum ThreadSortOption {
	NewestFirst = 'newest',
	OldestFirst = 'oldest',
	AlphabeticalAsc = 'alpha_asc',
	AlphabeticalDesc = 'alpha_desc',
	MessageCountHigh = 'count_high',
	MessageCountLow = 'count_low',
	UserCountAsc = 'users_asc',
	UserCountDesc = 'users_desc'
}



// Get auth headers helper function (no changes needed)
function getAuthHeaders(): Record<string, string> {
	const user = get(currentUser);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (user?.token) {
		headers['Authorization'] = `Bearer ${user.token}`;
	}

	return headers;
}

// Fetch threads function that uses Fetch API with errorUtils
export async function fetchThreads(): Promise<Threads[]> {
	const result = await clientTryCatch((async () => {
		await ensureAuthenticated();
		const user = get(currentUser);

		if (!user || !user.token) {
			throw new Error('User not authenticated');
		}

		const fetchResult = await fetchTryCatch<{ threads: Threads[] }>(
			'/api/keys/threads',
			{
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${user.token}`
				}
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to fetch threads: ${fetchResult.error}`);
		}

		const data = fetchResult.data;
		return data.threads || [];
	})(), 'Fetching threads');

	if (isFailure(result)) {
		console.error('Error fetching threads:', result.error);
		throw new Error(result.error);
	}

	return result.data;
}

// Function to update thread using Fetch API with errorUtils
async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
	const result = await clientTryCatch((async () => {
		ensureAuthenticated();

		const fetchResult = await fetchTryCatch<{ success: boolean; data: Threads; error?: string }>(
			`/api/threads/${id}`,
			{
				method: 'PATCH',
				headers: getAuthHeaders(),
				credentials: 'include',
				body: JSON.stringify(changes)
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to update thread: ${fetchResult.error}`);
		}

		const data = fetchResult.data;

		if (!data.success && !data.data) {
			throw new Error(data.error || 'Failed to update thread');
		}

		return data.data || data;
	})(), `Updating thread ${id}`);

	if (isFailure(result)) {
		console.error('Error updating thread:', result.error);
		throw new Error(result.error);
	}

	return result.data;
}

export function createThreadsStore() {
	const initialShowThreadList = browser
		? localStorage.getItem('threadListVisible') === 'true'
		: false;
	const store = writable<ThreadStoreState>({
		threads: [],
		currentThreadId: null,
		messages: [],
		updateStatus: '',
		isThreadsLoaded: false,
		showThreadList: initialShowThreadList,
		isEditingThreadName: false,
		editedThreadName: '',
		searchQuery: '',
		namingThreadId: null,
		sortOption: ThreadSortOption.NewestFirst,
		selectedUserIds: new Set<string>(),
		selectedTagIds: new Set<string>(),
		availableUsers: [],
		isLoading: false,
		isUpdating: false,
		error: null,
		currentThread: null,
		filteredThreads: [],
		isNaming: false,
		project_id: '',
		showFavoriteThreads: false
	});
	const { subscribe, update } = store;
	const sortOptionInfo = derived(store, ($store) => getSortOptionInfo($store.sortOption));
	const allSortOptions = derived(store, () =>
		Object.values(ThreadSortOption).map((option) => getSortOptionInfo(option))
	);
	const searchedThreads = derived(store, ($store) => {
		let filteredThreads =
			$store.searchQuery.trim().length > 0
				? $store.threads.filter(
						(thread) =>
							thread.name?.toLowerCase().includes($store.searchQuery.toLowerCase().trim()) ||
							thread.last_message?.content
								?.toLowerCase()
								.includes($store.searchQuery.toLowerCase().trim())
					)
				: [...$store.threads];

		if ($store.selectedUserIds.size > 0) {
			filteredThreads = filteredThreads.filter((thread) => {
				if (thread.user && $store.selectedUserIds.has(thread.user)) {
					return true;
				}

				if (thread.participants && Array.isArray(thread.participants)) {
					return thread.participants.some((participant) => {
						const participantId =
							typeof participant === 'string'
								? participant
								: participant && participant.id
									? participant.id
									: null;

						return participantId && $store.selectedUserIds.has(participantId);
					});
				}

				return false;
			});
		}

		return filteredThreads.sort((a, b) => {
			switch ($store.sortOption) {
				case ThreadSortOption.NewestFirst:
					return (
						new Date(b.updated || b.created || 0).getTime() -
						new Date(a.updated || a.created || 0).getTime()
					);

				case ThreadSortOption.OldestFirst:
					return (
						new Date(a.updated || a.created || 0).getTime() -
						new Date(b.updated || b.created || 0).getTime()
					);

				case ThreadSortOption.AlphabeticalAsc:
					return (a.name || '').localeCompare(b.name || '');

				case ThreadSortOption.AlphabeticalDesc:
					return (b.name || '').localeCompare(a.name || '');

				case ThreadSortOption.MessageCountHigh: {
					const aCount = a.message_count || 0;
					const bCount = b.message_count || 0;
					return bCount - aCount;
				}

				case ThreadSortOption.MessageCountLow: {
					const aCountLow = a.message_count || 0;
					const bCountLow = b.message_count || 0;
					return aCountLow - bCountLow;
				}

				case ThreadSortOption.UserCountAsc: {
					const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
					const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
					return aUsers - bUsers;
				}

				case ThreadSortOption.UserCountDesc: {
					const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
					const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
					return bUsersDesc - aUsersDesc;
				}

				default:
					return 0;
			}
		});
	});
	const favoritedThreads = derived(
		[searchedThreads, store, currentUser],
		([$searchedThreads, $store, $currentUser]) => {
			if (!$store.showFavoriteThreads || !$currentUser?.favoriteThreads?.length) {
				return $searchedThreads || []; // Return all searched threads if not filtering favorites
			}

			// Filter to only show favorited threads
			return ($searchedThreads || []).filter((thread) =>
				$currentUser.favoriteThreads.includes(thread.id)
			);
		}
	);

	const selectedUserIds = derived(store, ($store) => $store.selectedUserIds);
	const availableUsers = derived(store, ($store) => $store.availableUsers);

	// Create a dedicated derived store for the showThreadList property
	const showThreadList = derived(store, ($store) => $store.showThreadList);

	return {
		subscribe,
		update,
		sortOptionInfo,
		allSortOptions,
		searchedThreads,
		favoritedThreads,
		selectedUserIds,
		availableUsers,
		showThreadList,

		toggleThreadList: () => {
			update((state) => {
				const newShowThreadList = !state.showThreadList;
				if (browser) {
					localStorage.setItem('threadListVisible', String(newShowThreadList));
				}
				return {
					...state,
					showThreadList: newShowThreadList
				};
			});
		},

		setSortOption: (option: ThreadSortOption) => {
			update((state) => ({
				...state,
				sortOption: option
			}));
		},

		applySortOption: (threads: Threads[], sortOption: ThreadSortOption) => {
			return threads.sort((a, b) => {
				switch (sortOption) {
					case ThreadSortOption.NewestFirst:
						return (
							new Date(b.updated || b.created || 0).getTime() -
							new Date(a.updated || a.created || 0).getTime()
						);

					case ThreadSortOption.OldestFirst:
						return (
							new Date(a.updated || a.created || 0).getTime() -
							new Date(b.updated || b.created || 0).getTime()
						);

					case ThreadSortOption.AlphabeticalAsc:
						return (a.name || '').localeCompare(b.name || '');

					case ThreadSortOption.AlphabeticalDesc:
						return (b.name || '').localeCompare(a.name || '');

					case ThreadSortOption.MessageCountHigh: {
						const aCount = a.message_count || 0;
						const bCount = b.message_count || 0;
						return bCount - aCount;
					}
					case ThreadSortOption.MessageCountLow: {
						const aCountLow = a.message_count || 0;
						const bCountLow = b.message_count || 0;
						return aCountLow - bCountLow;
					}
					case ThreadSortOption.UserCountAsc: {
						const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return aUsers - bUsers;
					}
					case ThreadSortOption.UserCountDesc: {
						const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return bUsersDesc - aUsersDesc;
					}
					default:
						return 0;
				}
			});
		},

		setThreadListVisibility: (visible: boolean) => {
			update((state) => {
				if (browser) {
					localStorage.setItem('threadListVisible', String(visible));
				}
				return {
					...state,
					showThreadList: visible
				};
			});
		},

loadThreads: async (): Promise<Threads[]> => {
			const result = await clientTryCatch((async () => {
				update((state) => ({
					...state,
					isLoading: true,
					error: null
				}));

				// Make sure to handle authentication properly
				const authResult = await clientTryCatch(ensureAuthenticated(), 'Authentication check');
				if (isFailure(authResult)) {
					console.warn('Authentication check failed:', authResult.error);
					// Don't throw here, continue and let the fetch handle it
				}

				const user = get(currentUser);
				if (!user?.token) {
					console.warn('No user token available, attempting to fetch threads anyway');
				}

				const threads = await fetchThreads();

				update((state) => ({
					...state,
					threads,
					isThreadsLoaded: true,
					updateStatus: 'Threads loaded successfully',
					isLoading: false
				}));

				return threads;
			})(), 'Loading threads');

			if (isFailure(result)) {
				console.error('Error loading threads:', result.error);
				update((state) => ({
					...state,
					isLoading: false,
					error: result.error,
					updateStatus: 'Failed to load threads'
				}));

				// Return the existing threads instead of throwing
				return get(store).threads;
			}

			return result.data;
		},

		loadMessages: async (threadId: string): Promise<Messages[]> => {
			const result = await clientTryCatch((async () => {
				const messagesResult = await fetchMessagesForThread(threadId);
				
				// If fetchMessagesForThread returns a Result type, extract the data
				let messages: Messages[];
				if (messagesResult && typeof messagesResult === 'object' && 'success' in messagesResult) {
					if (isFailure(messagesResult)) {
						throw new Error(messagesResult.error);
					}
					messages = messagesResult.data;
				} else {
					messages = messagesResult as Messages[];
				}
				
				store.update((state) => ({ ...state, messages, currentThreadId: threadId }));
				return messages;
			})(), `Loading messages for thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error loading messages:', result.error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to load messages' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}

			return result.data;
		},

addThread: async (threadData: Partial<Threads>): Promise<Threads | null> => {
	const result = await clientTryCatch((async () => {
		console.log('Adding thread with data:', threadData);
		const newThreadResult = await createThread(threadData);
		
		// Handle if createThread returns a Result type
		let newThread: Threads;
		if (newThreadResult && typeof newThreadResult === 'object' && 
			'success' in newThreadResult && 'data' in newThreadResult && 'error' in newThreadResult &&
			typeof (newThreadResult as { success: unknown }).success === 'boolean') {
			// This is a Result type
			const resultType = newThreadResult as { success: boolean; data: Threads; error: unknown };
			if (!resultType.success) {
				throw new Error(String(resultType.error));
			}
			newThread = resultType.data;
		} else {
			// This is the actual data - convert through unknown first
			newThread = newThreadResult as unknown as Threads;
		}
		
		const currentState = get(store);
		
		if (newThread.project_id) {
			const projectThreadsResult = await fetchThreadsForProject(newThread.project_id);
			
			// Handle if fetchThreadsForProject returns a Result type
			let projectThreads: Threads[];
			if (projectThreadsResult && typeof projectThreadsResult === 'object' && 
				'success' in projectThreadsResult && 'data' in projectThreadsResult && 'error' in projectThreadsResult &&
				typeof (projectThreadsResult as { success: unknown }).success === 'boolean') {
				// This is a Result type
				const resultType = projectThreadsResult as { success: boolean; data: Threads[]; error: unknown };
				if (!resultType.success) {
					throw new Error(String(resultType.error));
				}
				projectThreads = resultType.data;
			} else {
				// This is the actual data - convert through unknown first
				projectThreads = projectThreadsResult as unknown as Threads[];
			}
			
			store.update((state) => ({
				...state,
				threads: projectThreads,
				isThreadsLoaded: true,
				updateStatus: 'Thread added successfully',
				showThreadList: currentState.showThreadList
			}));
		} else {
			const updatedThreadsResult = await fetchThreads();
			
			// Handle if fetchThreads returns a Result type
			let updatedThreads: Threads[];
			if (updatedThreadsResult && typeof updatedThreadsResult === 'object' && 
				'success' in updatedThreadsResult && 'data' in updatedThreadsResult && 'error' in updatedThreadsResult &&
				typeof (updatedThreadsResult as { success: unknown }).success === 'boolean') {
				// This is a Result type
				const resultType = updatedThreadsResult as { success: boolean; data: Threads[]; error: unknown };
				if (!resultType.success) {
					throw new Error(String(resultType.error));
				}
				updatedThreads = resultType.data;
			} else {
				// This is the actual data - convert through unknown first
				updatedThreads = updatedThreadsResult as unknown as Threads[];
			}
			
			store.update((state) => ({
				...state,
				threads: updatedThreads,
				isThreadsLoaded: true,
				updateStatus: 'Thread added successfully',
				showThreadList: currentState.showThreadList
			}));
		}

		setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
		return newThread;
	})(), 'Adding thread');

	if (isFailure(result)) {
		console.error('Error adding thread:', result.error);
		store.update((state) => ({ ...state, updateStatus: 'Failed to add thread' }));
		setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
		return null;
	}

	return result.data;
},

		updateThread: async (id: string, changes: Partial<Threads>) => {
			const result = await clientTryCatch((async () => {
				update((state) => ({
					...state,
					isUpdating: true,
					error: null
				}));

				const updatedThread = await updateThread(id, changes);

				const currentState = get(store);
				const existingThread = currentState.threads.find((t) => t.id === id);

				update((state) => ({
					...state,
					threads: state.threads.map((t) =>
						t.id === id
							? {
									...(existingThread || t),
									...updatedThread,
									...changes
								}
							: t
					),
					isUpdating: false,
					updateStatus: 'Thread updated successfully'
				}));

				return updatedThread;
			})(), `Updating thread ${id}`);

			if (isFailure(result)) {
				console.error('Failed to update thread:', result.error);
				update((state) => ({
					...state,
					isUpdating: false,
					error: result.error,
					updateStatus: 'Failed to update thread'
				}));
				throw new Error(result.error);
			}

			return result.data;
		},

		getThreadCollaborators: async (threadId: string): Promise<User[]> => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<{ success: boolean; data: User[]; error?: string }>(
					`/api/threads/${threadId}/collaborators`,
					{
						method: 'GET',
						credentials: 'include',
						headers: getAuthHeaders()
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to get thread collaborators: ${fetchResult.error}`);
				}

				const data = fetchResult.data;

				if (!data.success && !Array.isArray(data)) {
					throw new Error(data.error || 'Failed to get thread collaborators');
				}

				return Array.isArray(data) ? data : data.data || [];
			})(), `Getting collaborators for thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error getting thread collaborators:', result.error);
				return [];
			}

			return result.data;
		},

		// Add collaborator to thread
		addThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<{ success: boolean; data: Threads; error?: string }>(
					`/api/threads/${threadId}/collaborators`,
					{
						method: 'POST',
						headers: getAuthHeaders(),
						credentials: 'include',
						body: JSON.stringify({ userId })
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to add collaborator to thread: ${fetchResult.error}`);
				}

				const data = fetchResult.data;

				if (!data.success && !data.data) {
					throw new Error(data.error || 'Failed to add collaborator to thread');
				}

				// Update the store
				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...data.data } : t)),
					updateStatus: 'Thread collaborator added successfully'
				}));

				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return data.data || data;
			})(), `Adding collaborator ${userId} to thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error adding thread collaborator:', result.error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add thread collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}

			return result.data;
		},

		// Remove collaborator from thread
		removeThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<{ success: boolean; data: Threads; error?: string }>(
					`/api/threads/${threadId}/collaborators/${userId}`,
					{
						method: 'DELETE',
						credentials: 'include',
						headers: getAuthHeaders()
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to remove collaborator from thread: ${fetchResult.error}`);
				}

				const data = fetchResult.data;

				if (!data.success && !data.data) {
					throw new Error(data.error || 'Failed to remove collaborator from thread');
				}

				// Update the store
				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...data.data } : t)),
					updateStatus: 'Thread collaborator removed successfully'
				}));

				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return data.data || data;
			})(), `Removing collaborator ${userId} from thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error removing thread collaborator:', result.error);
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to remove thread collaborator'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}

			return result.data;
		},

		toggleThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			const result = await clientTryCatch((async () => {
				const thread = get(store).threads.find((t) => t.id === threadId);
				if (!thread) {
					throw new Error('Thread not found');
				}

				// Fix type error by ensuring members is an array of strings
				const currentMembers = thread.members
					? typeof thread.members === 'string'
						? thread.members.split(',').map((m) => m.trim())
						: Array.isArray(thread.members)
							? thread.members
							: []
					: [];

				const isAlreadyMember = currentMembers.includes(userId);

				if (isAlreadyMember) {
					return await threadsStore.removeThreadCollaborator(threadId, userId);
				} else {
					return await threadsStore.addThreadCollaborator(threadId, userId);
				}
			})(), `Toggling collaborator ${userId} for thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error toggling thread collaborator:', result.error);
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to update thread collaborator'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}

			return result.data;
		},

		autoUpdateThreadName: async (
			threadId: string,
			messages: Messages[],
			model: AIModel,
			userId: string
		) => {
			const result = await clientTryCatch((async () => {
				store.update((state) => ({ ...state, namingThreadId: threadId }));

				const updatedThread = await autoUpdateThreadName(threadId, messages, model, userId);

				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...updatedThread } : t)),
					updateStatus: 'Thread name updated automatically',
					namingThreadId: null
				}));

				setTimeout(
					() =>
						store.update((state) => ({
							...state,
							updateStatus: ''
						})),
					3000
				);
				return updatedThread;
			})(), `Auto-updating name for thread ${threadId}`);

			if (isFailure(result)) {
				console.error('Error in autoUpdateThreadName:', result.error);
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to auto-update thread name',
					namingThreadId: null
				}));
				setTimeout(
					() =>
						store.update((state) => ({
							...state,
							updateStatus: ''
						})),
					3000
				);
				return null;
			}

			return result.data;
		},

		getCurrentThread: derived(store, ($store) => {
			return $store.threads.find((t) => t.id === $store.currentThreadId) || null;
		}),

		addMessage: async (
			message: Omit<Messages, 'id' | 'created' | 'updated'>
		): Promise<Messages | null> => {
			const result = await clientTryCatch((async () => {
				const newMessageResult = await addMessageToThread(message);
				
				// Handle if addMessageToThread returns a Result type
				let newMessage: Messages;
				if (newMessageResult && typeof newMessageResult === 'object' && 
					'success' in newMessageResult && 'data' in newMessageResult && 'error' in newMessageResult &&
					typeof (newMessageResult as { success: unknown }).success === 'boolean') {
					// This is a Result type
					const resultType = newMessageResult as { success: boolean; data: Messages; error: unknown };
					if (!resultType.success) {
						throw new Error(String(resultType.error));
					}
					newMessage = resultType.data;
				} else {
					// This is the actual data - convert through unknown first
					newMessage = newMessageResult as unknown as Messages;
				}
				
				store.update((state) => ({
					...state,
					messages: [...state.messages, newMessage],
					updateStatus: 'Message added successfully'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return newMessage;
			})(), `Adding message to thread ${message.thread}`);

			if (isFailure(result)) {
				console.error('Error adding message:', result.error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add message' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}

			return result.data;
		},

		setCurrentThread: async (id: string | null) => {
			if (id) {
				const result = await clientTryCatch((async () => {
					const messagesResult = await fetchMessagesForThread(id);
					
					// If fetchMessagesForThread returns a Result type, extract the data
					let messages: Messages[];
					if (messagesResult && typeof messagesResult === 'object' && 'success' in messagesResult) {
						if (isFailure(messagesResult)) {
							throw new Error(messagesResult.error);
						}
						messages = messagesResult.data;
					} else {
						messages = messagesResult as Messages[];
					}
					
					store.update((state) => ({
						...state,
						currentThreadId: id,
						currentThread: state.threads.find((t) => t.id === id) || null,
						messages,
						updateStatus: 'Current thread updated'
					}));
					return messages;
				})(), `Setting current thread to ${id}`);

				if (isFailure(result)) {
					console.error('Error loading messages for thread:', result.error);
					store.update((state) => ({
						...state,
						currentThreadId: id,
						currentThread: state.threads.find((t) => t.id === id) || null,
						messages: [],
						updateStatus: 'Error loading messages'
					}));
				}
			} else {
				store.update((state) => ({
					...state,
					currentThreadId: null,
					currentThread: null,
					messages: [],
					updateStatus: 'Thread selection cleared'
				}));
			}
		},
		setNamingThreadId: (threadId: string | null) => {
			store.update((state) => ({
				...state,
				namingThreadId: threadId
			}));
		},

		reset: () => {
			store.update((state) => ({
				...state,
				currentThreadId: null,
				currentThread: null,
				messages: [],
				updateStatus: '',
				isThreadsLoaded: false
			}));
			if (browser) {
				const url = new URL(window.location.href);
				url.searchParams.delete('threadId');
				url.searchParams.delete('messageId');
				url.searchParams.delete('autoTrigger');
				window.history.replaceState({}, '', url);
			}
		},

		clearCurrentThread: () => {
			store.update((state) => ({
				...state,
				currentThreadId: null,
				currentThread: null,
				messages: [],
				updateStatus: 'Thread selection cleared'
			}));
		},

		getThreadById: (id: string) =>
			derived(store, ($store) => {
				return $store.threads.find((t) => t.id === id) || null;
			}),

		getMessagesByDate: derived(store, ($store) => {
			const groups: { [key: string]: Messages[] } = {};
			$store.messages.forEach((message) => {
				const date = new Date(message.created).toLocaleDateString();
				if (!groups[date]) {
					groups[date] = [];
				}
				groups[date].push(message);
			});
			return Object.entries(groups).map(([date, messages]) => ({ date, messages }));
		}),

		isSearchActive: derived(store, ($store) => $store.searchQuery.trim().length > 0),

		getUniqueTags: derived(store, ($store) => {
			const allTags = $store.threads.flatMap((thread) => thread.tags || []);
			return [...new Set(allTags)];
		}),

		isThreadsLoaded: derived(store, ($store) => $store.isThreadsLoaded),

		// Toggle through sorting options
		toggleSortOption: () => {
			update((state) => {
				const options = Object.values(ThreadSortOption);
				const currentIndex = options.indexOf(state.sortOption);
				const nextIndex = (currentIndex + 1) % options.length;

				return {
					...state,
					sortOption: options[nextIndex]
				};
			});
		},

		// Load available users from threads
		loadAvailableUsers: () => {
			update((state) => {
				const userMap = new Map<string, string>();

				state.threads.forEach((thread) => {
					if (thread.user) {
						// For single user field
						userMap.set(thread.user, thread.user_name || thread.user);
					}

					// For participants array if it exists
					if (thread.participants && Array.isArray(thread.participants)) {
						thread.participants.forEach((participant) => {
							if (typeof participant === 'string') {
								userMap.set(participant, participant);
							} else if (participant && participant.id) {
								userMap.set(participant.id, participant.name || participant.id);
							}
						});
					}
				});

				const availableUsers = Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));

				return {
					...state,
					availableUsers
				};
			});
		},

		toggleUserSelection: (userId: string) => {
			update((state) => {
				const newSelection = new Set(state.selectedUserIds);

				if (newSelection.has(userId)) {
					newSelection.delete(userId);
				} else {
					newSelection.add(userId);
				}

				return {
					...state,
					selectedUserIds: newSelection
				};
			});
		},

		clearSelectedUsers: () => {
			update((state) => ({
				...state,
				selectedUserIds: new Set<string>()
			}));
		},

		refreshThreadTimes: () => {
			update((state) => ({
				...state,
				date: new Date().toISOString()
			}));
		},

		setSearchQuery: (query: string) => {
			console.log('📝 Setting search query in store:', query);
			store.update((state) => ({
				...state,
				searchQuery: query
			}));
		},

		setFavoriteFilter: (showFavorites: boolean) => {
			update((state) => ({
				...state,
				showFavoriteThreads: showFavorites
			}));
		},
		toggleFavoriteFilter: () => {
			update((state) => {
				const newShowFavorites = !state.showFavoriteThreads;
				console.log('🔄 Toggling favorite filter:', {
					from: state.showFavoriteThreads,
					to: newShowFavorites
				});
				return {
					...state,
					showFavoriteThreads: newShowFavorites
				};
			});
		},

toggleThreadFavorite: async (threadId: string): Promise<boolean> => {
	const result = await clientTryCatch((async () => {
		const user = get(currentUser);
		if (!user) throw new Error('User not authenticated');

		const isFavorited = user.favoriteThreads?.includes(threadId) || false;
		const action = isFavorited ? 'remove' : 'add';

		const fetchResult = await fetchTryCatch<{ success: boolean; favoriteThreads?: string[]; bookmarks?: string[]; message?: string }>(
			'/api/favorites',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					threadId,
					action
				})
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to update favorite thread: ${fetchResult.error}`);
		}

		const result = fetchResult.data;

		if (result.success) {
			currentUser.update((currentUser) => {
				if (!currentUser) return currentUser;
				return {
					...currentUser,
					favoriteThreads: result.favoriteThreads || result.bookmarks || []
				};
			});

			update((state) => ({
				...state,
				updateStatus: isFavorited ? 'Removed from favorites' : 'Added to favorites'
			}));

			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 2000);
			return !isFavorited;
		} else {
			throw new Error(result.message || 'Favorite operation failed');
		}
	})(), `Toggling favorite for thread ${threadId}`);

	if (isFailure(result)) {
		console.error('Error toggling thread favorite:', result.error);
		update((state) => ({
			...state,
			updateStatus: 'Failed to update favorite'
		}));
		setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 2000);
		throw new Error(result.error);
	}

	return result.data;
},

		isThreadFavorited: (threadId: string): boolean => {
			const user = get(currentUser);
			return user?.favoriteThreads?.includes(threadId) || false;
		},
		getSortedAndFilteredThreads: derived(store, ($store) => {
			// First apply search filter
			let filteredThreads =
				$store.searchQuery.trim().length > 0
					? $store.threads.filter(
							(thread) =>
								thread.name?.toLowerCase().includes($store.searchQuery.toLowerCase().trim()) ||
								thread.last_message?.content
									?.toLowerCase()
									.includes($store.searchQuery.toLowerCase().trim())
						)
					: [...$store.threads];

			// Apply user filter if any users are selected
			if ($store.selectedUserIds.size > 0) {
				filteredThreads = filteredThreads.filter((thread) => {
					// Check if thread creator is selected
					if (thread.user && $store.selectedUserIds.has(thread.user)) {
						return true;
					}

					// Check if any participant is selected
					if (thread.participants && Array.isArray(thread.participants)) {
						return thread.participants.some((participant) => {
							const participantId =
								typeof participant === 'string'
									? participant
									: participant && participant.id
										? participant.id
										: null;

							return participantId && $store.selectedUserIds.has(participantId);
						});
					}

					return false;
				});
			}

			// Apply sorting
			return filteredThreads.sort((a, b) => {
				switch ($store.sortOption) {
					case ThreadSortOption.NewestFirst:
						return (
							new Date(b.updated || b.created || 0).getTime() -
							new Date(a.updated || a.created || 0).getTime()
						);

					case ThreadSortOption.OldestFirst:
						return (
							new Date(a.updated || a.created || 0).getTime() -
							new Date(b.updated || b.created || 0).getTime()
						);

					case ThreadSortOption.AlphabeticalAsc:
						return (a.name || '').localeCompare(b.name || '');

					case ThreadSortOption.AlphabeticalDesc:
						return (b.name || '').localeCompare(a.name || '');

					case ThreadSortOption.MessageCountHigh: {
						const aCount = a.message_count || 0;
						const bCount = b.message_count || 0;
						return bCount - aCount;
					}
					case ThreadSortOption.MessageCountLow: {
						const aCountLow = a.message_count || 0;
						const bCountLow = b.message_count || 0;
						return aCountLow - bCountLow;
					}
					case ThreadSortOption.UserCountAsc: {
						const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return aUsers - bUsers;
					}
					case ThreadSortOption.UserCountDesc: {
						const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return bUsersDesc - aUsersDesc;
					}
					default:
						return 0;
				}
			});
		})
	};
}

function getSortOptionInfo(option: ThreadSortOption): SortOptionInfo {
	switch (option) {
		case ThreadSortOption.NewestFirst:
			return {
				value: option,
				label: '↑',
				icon: CalendarDays
			};
		case ThreadSortOption.OldestFirst:
			return {
				value: option,
				label: '↓',
				icon: CalendarDays
			};
		case ThreadSortOption.AlphabeticalAsc:
			return {
				value: option,
				label: 'A-Z',
				icon: SortAsc
			};
		case ThreadSortOption.AlphabeticalDesc:
			return {
				value: option,
				label: 'Z-A',
				icon: SortDesc
			};
		case ThreadSortOption.MessageCountHigh:
			return {
				value: option,
				label: '↑#',
				icon: MessageSquare
			};
		case ThreadSortOption.MessageCountLow:
			return {
				value: option,
				label: '↓#',
				icon: MessageSquare
			};
		case ThreadSortOption.UserCountAsc:
			return {
				value: option,
				label: '↑#',
				icon: UserCircle
			};
		case ThreadSortOption.UserCountDesc:
			return {
				value: option,
				label: '↓#',
				icon: UserIcon
			};
		default:
			return {
				value: ThreadSortOption.NewestFirst,
				label: 'Newest First',
				icon: ArrowDown
			};
	}
}

export const threadsStore = createThreadsStore();

export function getThreadsStore() {
	return get(threadsStore);
}

export const showThreadList = derived(
	threadsStore.showThreadList,
	($showThreadList) => $showThreadList
);

if (browser) {
	setInterval(() => {
		threadsStore.refreshThreadTimes();
	}, 60000); // Refresh every minute
}
