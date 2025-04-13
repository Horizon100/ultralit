import { writable, derived, get } from 'svelte/store';
import { pb, ensureAuthenticated, fetchThreads, updateThread as clientUpdateThread } from '$lib/pocketbase';
import type { Messages, Threads, AIModel, ThreadStoreState } from '$lib/types/types';
import { debounce } from 'lodash-es';
import {
	fetchMessagesForThread,
	createThread,
	addMessageToThread,
	autoUpdateThreadName
} from '$lib/clients/threadsClient';
import { fetchThreadsForProject } from '$lib/clients/projectClient';
import { t } from '$lib/stores/translationStore';

import { browser } from '$app/environment';
import { replaceState } from '$app/navigation';
import { ArrowDown, ArrowUp, CalendarDays, MessageSquare, SortAsc, SortDesc, User, UserCircle } from 'lucide-svelte';

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
  

export function createThreadsStore() {
	const initialShowThreadList = browser
		? localStorage.getItem('threadListVisible') !== 'false'
		: true;

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
			selectedTagIds: new Set(),
			date: new Date().toISOString(),
			sortOption: ThreadSortOption.NewestFirst,
			selectedUserIds: new Set(),
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
				console.log('Toggling thread list visibility:', {
					old: state.showThreadList,
					new: newShowThreadList
				});
				return {
					...state,
					showThreadList: newShowThreadList
				};
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
				// ensureAuthenticated();
				// const userId = pb.authStore.model?.id;
				// if (!userId) {
				// 	throw new Error('User ID not found');
				// }
				console.log('Starting loadThreads, current state:', get(store));
				const threads = await fetchThreads();
				console.log('Fetched threads, about to update store');
				const currentState = get(store);
				store.update((state) => {
					console.log(
						'Updating store with threads, preserving showThreadList:',
						state.showThreadList
					);
					return {
						...state,
						threads,
						isThreadsLoaded: true,
						updateStatus: 'Threads loaded successfully',
						showThreadList: currentState.showThreadList
					};
				});

				console.log('Store updated, new state:', get(store));
				return threads;
			} catch (error) {
				console.error('Error loading threads:', error);
				return [];
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
				// ensureAuthenticated();
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
				const updatedThread = await clientUpdateThread(id, changes);
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
    const thread = get(store).threads.find(t => t.id === threadId);
    if (!thread || !thread.members || !Array.isArray(thread.members) || thread.members.length === 0) {
      return [];
    }

    // Get member IDs
    const memberIds = thread.members.filter(id => typeof id === 'string');
    
    if (memberIds.length === 0) {
      return [];
    }

    // Fetch user details for these IDs
    const users = await pb.collection('users').getFullList<User>({
      filter: memberIds.map(id => `id="${id}"`).join(' || ')
    });
    
    return users;
  } catch (error) {
    console.error('Error getting thread collaborators:', error);
    return [];
  }
},

// Add collaborator to thread
addThreadCollaborator: async (threadId: string, userId: string): Promise<Threads | null> => {
  try {
    const thread = get(store).threads.find(t => t.id === threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Get current members
    const currentMembers = thread.members || [];
    
    // Check if user is already a member
    if (currentMembers.includes(userId)) {
      return thread;
    }

    // Add the user
    const updatedMembers = [...currentMembers, userId];
    
    // Update the thread
    const updatedThread = await clientUpdateThread(threadId, {
      members: updatedMembers
    });

    // Update the store
    store.update((state) => ({
      ...state,
      threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...updatedThread } : t)),
      updateStatus: 'Thread collaborator added successfully'
    }));

    setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
    return updatedThread;
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
    const thread = get(store).threads.find(t => t.id === threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Get current members
    const currentMembers = thread.members || [];
    
    // Remove the user
    const updatedMembers = currentMembers.filter(id => id !== userId);
    
    // Update the thread
    const updatedThread = await clientUpdateThread(threadId, {
      members: updatedMembers
    });

    // Update the store
    store.update((state) => ({
      ...state,
      threads: state.threads.map((t) => (t.id === threadId ? { ...t, ...updatedThread } : t)),
      updateStatus: 'Thread collaborator removed successfully'
    }));

    setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
    return updatedThread;
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

		/*
		 * setSelectedTags: (tagIds: string[]) => {
		 *   store.update(state => ({
		 *     ...state,
		 *     selectedTagIds: new Set(tagIds)
		 *   }));
		 * },
		 * toggleTagSelection: (tagId: string) => {
		 *   store.update(state => {
		 *     const currentTags = state.selectedTagIds;
		 *     const newSelectedTags = new Set(currentTags);
		 */

		/*
		 *     console.log('Toggle tag:', tagId);
		 *     console.log('Before toggle:', Array.from(newSelectedTags));
		 */

		/*
		 *     if (newSelectedTags.has(tagId)) {
		 *       newSelectedTags.delete(tagId);
		 *     } else {
		 *       newSelectedTags.add(tagId);
		 *     }
		 */
		/*
		 *     // Create a new state object to ensure reactivity
		 *     return {
		 *       ...state,
		 *       selectedTagIds: newSelectedTags
		 *     };
		 *   });
		 * },
		 */

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
		/*
		 * Add a new function to get the current thread
		 * getCurrentThread: derived(store, $store =>
		 *   $store.threads.find(t => t.id === $store.currentThreadId) || null
		 * ),
		 */
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
		/*
		 * addTag: (tagName: string) => {
		 *   store.update(state => {
		 *     const newTag: Tag = {
		 *       id: crypto.randomUUID(), // Generate a unique ID
		 *       name: tagName,
		 *       color: '#000000', // Default color
		 *       selected_threads: [], // Empty array of selected threads
		 *       user: '', // This should probably be the current user's ID
		 *       collectionId: '', // Required by RecordModel
		 *       collectionName: '', // Required by RecordModel
		 *       created: new Date().toISOString(),
		 *       updated: new Date().toISOString()
		 *     };
		 *     return { ...state, tags: [...state.tags, newTag] };
		 *   });
		 * },
		 * updateTag: (index: number, newName: string) => {
		 *   store.update(state => {
		 *     const updatedTags = [...state.tags];
		 *     updatedTags[index].name = newName;
		 *     return { ...state, tags: updatedTags };
		 *   });
		 * },
		 * toggleTag: (index: number) => {
		 *   store.update(state => {
		 *     const updatedTags = [...state.tags];
		 *     updatedTags[index].selected = !updatedTags[index].selected;
		 *     return { ...state, tags: updatedTags };
		 *   });
		 * },
		 * addTagToThread: (threadId: string, tagName: string) => {
		 *   store.update(state => {
		 *     const updatedThreads = state.threads.map(thread => {
		 *       if (thread.id === threadId) {
		 *         const updatedTags = [...new Set([...(thread.tags || []), tagName])];
		 *         return { ...thread, tags: updatedTags };
		 *       }
		 *       return thread;
		 *     });
		 *     return { ...state, threads: updatedThreads };
		 *   });
		 *   const thread = get(store).threads.find(t => t.id === threadId);
		 *   if (thread) {
		 *     debouncedUpdateThread(threadId, { tags: thread.tags });
		 *   }
		 * },
		 * removeTagFromThread: (threadId: string, tagName: string) => {
		 *   store.update(state => {
		 *     const updatedThreads = state.threads.map(thread => {
		 *       if (thread.id === threadId) {
		 *         const updatedTags = (thread.tags || []).filter(tag => tag !== tagName);
		 *         return { ...thread, tags: updatedTags };
		 *       }
		 *       return thread;
		 *     });
		 *     return { ...state, threads: updatedThreads };
		 *   });
		 *   const thread = get(store).threads.find(t => t.id === threadId);
		 *   if (thread) {
		 *     debouncedUpdateThread(threadId, { tags: thread.tags });
		 *   }
		 * },
		 */

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
		getSearchedThreads: derived(store, ($store) => {
			// const query = $store.searchQuery.toLowerCase().trim();
			// if (!query) return $store.threads;

			// return $store.threads.filter(
			// 	(thread) =>
			// 		thread.name?.toLowerCase().includes(query) ||
			// 		thread.last_message?.content?.toLowerCase().includes(query)
			// );
			return this.getSortedAndFilteredThreads;

		}),
		// Get the current sort option info
		getCurrentSortOptionInfo: derived(store, ($store) => {
			return getSortOptionInfo($store.sortOption);
			}),
			
		// Get all available sort options
		getAllSortOptions: derived(store, () => {
		return Object.values(ThreadSortOption).map(option => getSortOptionInfo(option));
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
        selectedUserIds: new Set()
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
		  icon: User
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