//lib/stores/threadStore.ts
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

import { browser } from '$app/environment';
import { ArrowDown, ArrowUp, CalendarDays, MessageSquare, SortAsc, SortDesc, User as UserIcon, UserCircle } from 'lucide-svelte';

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
  
export interface SortOptionInfo {
	value: ThreadSortOption;
	label: string;
	icon: typeof import('lucide-svelte').LucideIcon;
}

// Helper function to handle fetch API responses
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ message: `API request failed with status ${response.status}` }));
		throw new Error(errorData.message || `API request failed with status ${response.status}`);
	}
	return await response.json();
}

// Get auth headers helper function
function getAuthHeaders(): HeadersInit {
	const user = get(currentUser);
	const headers: HeadersInit = {
		'Content-Type': 'application/json'
	};
	
	if (user?.token) {
		headers['Authorization'] = `Bearer ${user.token}`;
	}
	
	return headers;
}

// Fetch threads function that uses Fetch API instead of PocketBase
async function fetchThreads(): Promise<Threads[]> {
	try {
		ensureAuthenticated();
		
		console.log('Fetching threads, auth status:', !!get(currentUser)?.token);
		
		const response = await fetch('/api/threads', {
			method: 'GET',
			credentials: 'include',
			headers: getAuthHeaders()
		});
		
		// Enhanced error handling
		if (!response.ok) {
			const errorText = await response.text();
			let errorData: any = {};
			
			try {
				errorData = JSON.parse(errorText);
			} catch (e) {
				errorData = { message: errorText || 'Unknown error' };
			}
			
			console.error('API Error:', {
				status: response.status,
				statusText: response.statusText,
				url: response.url,
				errorData,
				errorText
			});
			
			throw new Error(errorData.message || errorData.error || `API request failed with status ${response.status}`);
		}
		
		const data = await response.json();
		
		if (!data?.success && !Array.isArray(data)) {
			console.warn('API returned unsuccessful response:', data);
			throw new Error(data?.error || 'Invalid response format');
		}
		
		// Handle case where API might return the array directly
		return Array.isArray(data) ? data : (data.data || []);
	} catch (error) {
		console.error('Detailed fetch error:', {
			error,
			user: get(currentUser)?.id,
			time: new Date().toISOString()
		});
		throw error;
	}
}

// Function to update thread using Fetch API
async function updateThread(id: string, changes: Partial<Threads>): Promise<Threads> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/threads/${id}`, {
			method: 'PATCH',
			headers: getAuthHeaders(),
			credentials: 'include',
			body: JSON.stringify(changes)
		});
		
		const data = await handleResponse<{ success: boolean; data: Threads; error?: string }>(response);
		
		if (!data.success && !data.data) {
			throw new Error(data.error || 'Failed to update thread');
		}
		
		return data.data || data;
	} catch (error) {
		console.error('Error updating thread:', error);
		throw error;
	}
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
		selectedTagIds: new Set<string>(),
		date: new Date().toISOString(),
		sortOption: ThreadSortOption.NewestFirst,
		selectedUserIds: new Set<string>(),
		availableUsers: []
	});
	const { subscribe, update } = store;
	const sortOptionInfo = derived(store, ($store) => getSortOptionInfo($store.sortOption));
	const allSortOptions = derived(store, () => Object.values(ThreadSortOption).map(option => getSortOptionInfo(option)));
	const searchedThreads = derived(store, ($store) => {
		let filteredThreads = $store.searchQuery.trim().length > 0
			? $store.threads.filter(
				thread => 
				thread.name?.toLowerCase().includes($store.searchQuery.toLowerCase().trim()) ||
				thread.last_message?.content?.toLowerCase().includes($store.searchQuery.toLowerCase().trim())
			)
			: [...$store.threads];
		
		if ($store.selectedUserIds.size > 0) {
			filteredThreads = filteredThreads.filter(thread => {
				if (thread.user && $store.selectedUserIds.has(thread.user)) {
					return true;
				}
				
				if (thread.participants && Array.isArray(thread.participants)) {
					return thread.participants.some(participant => {
						const participantId = typeof participant === 'string' 
							? participant 
							: (participant && participant.id ? participant.id : null);
						
						return participantId && $store.selectedUserIds.has(participantId);
					});
				}
				
				return false;
			});
		}
		
		if ($store.selectedTagIds.size > 0) {
			filteredThreads = filteredThreads.filter(thread => {
				if (!thread.tags || thread.tags.length === 0) return false;
				
				return thread.tags.some(tag => $store.selectedTagIds.has(tag));
			});
		}
		
		return filteredThreads.sort((a, b) => {
			switch ($store.sortOption) {
				case ThreadSortOption.NewestFirst:
					return new Date(b.updated || b.created || 0).getTime() - 
						new Date(a.updated || a.created || 0).getTime();
				
				case ThreadSortOption.OldestFirst:
					return new Date(a.updated || a.created || 0).getTime() - 
						new Date(b.updated || b.created || 0).getTime();
				
				case ThreadSortOption.AlphabeticalAsc:
					return (a.name || '').localeCompare(b.name || '');
				
				case ThreadSortOption.AlphabeticalDesc:
					return (b.name || '').localeCompare(a.name || '');
				
				case ThreadSortOption.MessageCountHigh:
					const aCount = a.message_count || 0;
					const bCount = b.message_count || 0;
					return bCount - aCount;
				
				case ThreadSortOption.MessageCountLow:
					const aCountLow = a.message_count || 0;
					const bCountLow = b.message_count || 0;
					return aCountLow - bCountLow;
				
				case ThreadSortOption.UserCountAsc:
					const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
					const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
					return aUsers - bUsers;
				
				case ThreadSortOption.UserCountDesc:
					const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
					const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
					return bUsersDesc - aUsersDesc;
				
				default:
					return 0;
			}
		});
	});
	const selectedUserIds = derived(store, ($store) => $store.selectedUserIds);
	const availableUsers = derived(store, ($store) => $store.availableUsers);
	
	return {
		subscribe,
		update,
		sortOptionInfo,
		allSortOptions,
		searchedThreads,
		selectedUserIds,
		availableUsers,
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
				  return new Date(b.updated || b.created || 0).getTime() - 
					new Date(a.updated || a.created || 0).getTime();
				
				case ThreadSortOption.OldestFirst:
				  return new Date(a.updated || a.created || 0).getTime() - 
					new Date(b.updated || b.created || 0).getTime();
				
				case ThreadSortOption.AlphabeticalAsc:
				  return (a.name || '').localeCompare(b.name || '');
				
				case ThreadSortOption.AlphabeticalDesc:
				  return (b.name || '').localeCompare(a.name || '');
				
				case ThreadSortOption.MessageCountHigh:
				  const aCount = a.message_count || 0;
				  const bCount = b.message_count || 0;
				  return bCount - aCount;
				
				case ThreadSortOption.MessageCountLow:
				  const aCountLow = a.message_count || 0;
				  const bCountLow = b.message_count || 0;
				  return aCountLow - bCountLow;
				
				case ThreadSortOption.UserCountAsc:
				  const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
				  const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
				  return aUsers - bUsers;
				
				case ThreadSortOption.UserCountDesc:
				  const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
				  const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
				  return bUsersDesc - aUsersDesc;
				
				default:
				  return 0;
			  }
			});
		  },
		setThreadListVisibility: (visible: boolean) => {
			update((state) => ({
				...state,
				showThreadList: visible
			}));
		},
		loadThreads: async (): Promise<Threads[]> => {
			try {
				console.log('Starting loadThreads');
				
				// Check if we can detect API issues early
				if (!get(currentUser)?.token) {
					console.warn('Warning: User token is missing, authentication may fail');
				}
				
				const threads = await fetchThreads();
				
				store.update((state) => {
					console.log('Updating store with threads');
					return {
						...state,
						threads,
						isThreadsLoaded: true,
						updateStatus: 'Threads loaded successfully',
						// Preserve current visibility state
						showThreadList: state.showThreadList 
					};
				});
				
				return threads;
			} catch (error) {
				console.error('Error loading threads:', error);
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to load threads',
					isThreadsLoaded: false
				}));
				throw error; // Re-throw to let calling code handle it
			}
		},
		loadMessages: async (threadId: string): Promise<Messages[]> => {
			try {
				const messages = await fetchMessagesForThread(threadId);
				store.update((state) => ({ ...state, messages, currentThreadId: threadId }));
				return messages;
			} catch (error) {
				console.error('Error loading messages:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to load messages' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},
		addThread: async (threadData: Partial<Threads>): Promise<Threads | null> => {
			try {
				console.log('Adding thread with data:', threadData); 
				const newThread = await createThread(threadData);
				const currentState = get(store);
				if (newThread.project_id) {
					const projectThreads = await fetchThreadsForProject(newThread.project_id);
					store.update((state) => ({
						...state,
						threads: projectThreads,
						isThreadsLoaded: true,
						updateStatus: 'Thread added successfully',
						showThreadList: currentState.showThreadList
					}));
				} else {
					const updatedThreads = await fetchThreads();
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
			} catch (error) {
				console.error('Error adding thread:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add thread' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},
		updateThread: async (id: string, changes: Partial<Threads>) => {
			try {
				console.log('Attempting to update thread:', id, 'with changes:', changes);
				const updatedThread = await updateThread(id, changes);
				console.log('Thread updated successfully:', updatedThread);
		
				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === id ? { ...t, ...updatedThread } : t)),
					updateStatus: 'Thread updated successfully'
				}));
		
				console.log('Store updated with new thread data');
				return updatedThread;
			} catch (error) {
				console.error('Failed to update thread:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to update thread' }));
				throw error;
			}
		},
		getThreadCollaborators: async (threadId: string): Promise<User[]> => {
			try {
				const response = await fetch(`/api/threads/${threadId}/collaborators`, {
					method: 'GET',
					credentials: 'include',
					headers: getAuthHeaders()
				});
				
				const data = await handleResponse<{ success: boolean; data: User[]; error?: string }>(response);
				
				if (!data.success && !Array.isArray(data)) {
					throw new Error(data.error || 'Failed to get thread collaborators');
				}
				
				return Array.isArray(data) ? data : (data.data || []);
			} catch (error) {
				console.error('Error getting thread collaborators:', error);
				return [];
			}
		},

		// Add collaborator to thread
		addThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			try {
				const response = await fetch(`/api/threads/${threadId}/collaborators`, {
					method: 'POST',
					headers: getAuthHeaders(),
					credentials: 'include',
					body: JSON.stringify({ userId })
				});
				
				const data = await handleResponse<{ success: boolean; data: Threads; error?: string }>(response);
				
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
			} catch (error) {
				console.error('Error adding thread collaborator:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add thread collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},

		// Remove collaborator from thread
		removeThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			try {
				const response = await fetch(`/api/threads/${threadId}/collaborators/${userId}`, {
					method: 'DELETE',
					credentials: 'include',
					headers: getAuthHeaders()
				});
				
				const data = await handleResponse<{ success: boolean; data: Threads; error?: string }>(response);
				
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
			} catch (error) {
				console.error('Error removing thread collaborator:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to remove thread collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},

		toggleThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
			try {
				const thread = get(store).threads.find(t => t.id === threadId);
				if (!thread) {
					throw new Error('Thread not found');
				}

				const currentMembers = thread.members || [];
				
				const isAlreadyMember = currentMembers.includes(userId);
				
				if (isAlreadyMember) {
					return await threadsStore.removeThreadCollaborator(threadId, userId);
				} else {
					return await threadsStore.addThreadCollaborator(threadId, userId);
				}
			} catch (error) {
				console.error('Error toggling thread collaborator:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to update thread collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},
		setSearchQuery: (query: string) => {
			store.update((state) => ({
				...state,
				searchQuery: query
			}));
		},

		autoUpdateThreadName: async (
			threadId: string,
			messages: Messages[],
			model: AIModel,
			userId: string
		) => {
			try {
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
			} catch (error) {
				console.error('Error in autoUpdateThreadName:', error);
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
		},
		getShowThreadList: derived({ subscribe }, ($state) => $state.showThreadList),
		getCurrentThread: derived(store, ($store) => {
			return $store.threads.find((t) => t.id === $store.currentThreadId) || null;
		}),
		addMessage: async (
			message: Omit<Messages, 'id' | 'created' | 'updated'>
		): Promise<Messages | null> => {
			try {
				const newMessage = await addMessageToThread(message);
				store.update((state) => ({
					...state,
					messages: [...state.messages, newMessage],
					updateStatus: 'Message added successfully'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return newMessage;
			} catch (error) {
				console.error('Error adding message:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add message' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},
		setCurrentThread: async (id: string | null) => {
			if (id) {
				try {
					const messages = await fetchMessagesForThread(id);
					store.update((state) => ({
						...state,
						currentThreadId: id,
						messages,
						updateStatus: 'Current thread updated'
					}));
				} catch (error) {
					console.error('Error loading messages for thread:', error);
					store.update((state) => ({
						...state,
						currentThreadId: id,
						updateStatus: 'Error loading messages'
					}));
				}
			} else {
				store.update((state) => ({
					...state,
					currentThreadId: null,
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
		setSortOption: (option: ThreadSortOption) => {
			update(state => ({
				...state,
				sortOption: option
			}));
		},
		
		// Toggle through sorting options
		toggleSortOption: () => {
			update(state => {
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
			update(state => {
				const userMap = new Map<string, string>();
				
				state.threads.forEach(thread => {
					if (thread.user) {
						// For single user field
						userMap.set(thread.user, thread.user_name || thread.user);
					}
					
					// For participants array if it exists
					if (thread.participants && Array.isArray(thread.participants)) {
						thread.participants.forEach(participant => {
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
		
		// Toggle user selection for filtering
		toggleUserSelection: (userId: string) => {
			update(state => {
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
		
		// Clear all selected users
		clearSelectedUsers: () => {
			update(state => ({
				...state,
				selectedUserIds: new Set<string>()
			}));
		},
		
		// Add a method to refresh relative times
		refreshThreadTimes: () => {
			update(state => ({
				...state,
				date: new Date().toISOString() // Update date to trigger reactivity
			}));
		},
		getSortedAndFilteredThreads: derived(store, ($store) => {
			// First apply search filter
			let filteredThreads = $store.searchQuery.trim().length > 0
				? $store.threads.filter(
					thread => 
					thread.name?.toLowerCase().includes($store.searchQuery.toLowerCase().trim()) ||
					thread.last_message?.content?.toLowerCase().includes($store.searchQuery.toLowerCase().trim())
				)
				: [...$store.threads];
			
			// Apply user filter if any users are selected
			if ($store.selectedUserIds.size > 0) {
				filteredThreads = filteredThreads.filter(thread => {
					// Check if thread creator is selected
					if (thread.user && $store.selectedUserIds.has(thread.user)) {
						return true;
					}
					
					// Check if any participant is selected
					if (thread.participants && Array.isArray(thread.participants)) {
						return thread.participants.some(participant => {
							const participantId = typeof participant === 'string' 
								? participant 
								: (participant && participant.id ? participant.id : null);
							
							return participantId && $store.selectedUserIds.has(participantId);
						});
					}
					
					return false;
				});
			}
			
			// Apply tag filter if any tags are selected
			if ($store.selectedTagIds.size > 0) {
				filteredThreads = filteredThreads.filter(thread => {
					if (!thread.tags || thread.tags.length === 0) return false;
					
					return thread.tags.some(tag => $store.selectedTagIds.has(tag));
				});
			}
			
			// Apply sorting
			return filteredThreads.sort((a, b) => {
				switch ($store.sortOption) {
					case ThreadSortOption.NewestFirst:
						return new Date(b.updated || b.created || 0).getTime() - 
							new Date(a.updated || a.created || 0).getTime();
					
					case ThreadSortOption.OldestFirst:
						return new Date(a.updated || a.created || 0).getTime() - 
							new Date(b.updated || b.created || 0).getTime();
					
					case ThreadSortOption.AlphabeticalAsc:
						return (a.name || '').localeCompare(b.name || '');
					
					case ThreadSortOption.AlphabeticalDesc:
						return (b.name || '').localeCompare(a.name || '');
					
					case ThreadSortOption.MessageCountHigh:
						const aCount = a.message_count || 0;
						const bCount = b.message_count || 0;
						return bCount - aCount;
					
					case ThreadSortOption.MessageCountLow:
						const aCountLow = a.message_count || 0;
						const bCountLow = b.message_count || 0;
						return aCountLow - bCountLow;
					
					case ThreadSortOption.UserCountAsc:
						const aUsers = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsers = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return aUsers - bUsers;
					
					case ThreadSortOption.UserCountDesc:
						const aUsersDesc = (a.participants?.length || 0) + (a.user ? 1 : 0);
						const bUsersDesc = (b.participants?.length || 0) + (b.user ? 1 : 0);
						return bUsersDesc - aUsersDesc;
					
					default:
						return 0;
				}
			});
		}),
	};
}

function getSortOptionInfo(option: ThreadSortOption): SortOptionInfo {
	switch (option) {
		case ThreadSortOption.NewestFirst:
			return { 
				value: option, 
				label: '↑', 
				icon: CalendarDays,
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
	
	if (browser) {
		setInterval(() => {
			threadsStore.refreshThreadTimes();
		}, 60000); // Refresh every minute
	}