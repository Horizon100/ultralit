import { writable, derived, get } from 'svelte/store';
import type { Messages, Threads, Tag, AIModel } from '$lib/types';
import { debounce } from 'lodash-es';
import { fetchThreads, fetchMessagesForThread, createThread, updateThread, addMessageToThread, autoUpdateThreadName } from '$lib/threadsClient';
import { fetchThreadsForProject } from '$lib/projectClient'
import { browser } from '$app/environment';




function createThreadsStore() {

  const initialShowThreadList = browser ? 
  localStorage.getItem('threadListVisible') !== 'false' : 
  true;

  const store = writable<{
    threads: Threads[],
    currentThreadId: string | null,
    messages: Messages[],
    updateStatus: string,
    isThreadsLoaded: boolean,
    showThreadList: boolean,
    searchQuery: string,
    namingThreadId: string | null,
    selectedTagIds: Set<string>,
    date: string,

  }>({
    threads: [],
    currentThreadId: null,
    messages: [],
    updateStatus: '',
    isThreadsLoaded: false,
      showThreadList: initialShowThreadList,
    searchQuery: '',
    namingThreadId: null,
    selectedTagIds: new Set(),
    date: '',
  });

  const { subscribe, update } = store;

  

  
  // if (browser) {
  //   store.subscribe(state => {
  //     localStorage.setItem('userTags', JSON.stringify(state.tags));
  //   });
  // }

  

  const debouncedUpdateThread = debounce(async (id: string, changes: Partial<Threads>) => {
    try {
      const updatedThread = await updateThread(id, changes);
      store.update(state => ({
        ...state,
        threads: state.threads.map(t => t.id === id ? { ...t, ...updatedThread } : t),
        updateStatus: 'Thread updated successfully'
      }));
      setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
    } catch (error) {
      console.error('Failed to update thread in backend:', error);
      store.update(state => ({ ...state, updateStatus: 'Failed to update thread' }));
      setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
    }
  }, 300);

  
  
  return {
    subscribe,
    update,
    toggleThreadList: () => {
      update(state => {
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
      update(state => ({
        ...state,
        showThreadList: visible
      }));
    },
    loadThreads: async (): Promise<Threads[]> => {
      try {
          console.log('Starting loadThreads, current state:', get(store));
          const threads = await fetchThreads();
          console.log('Fetched threads, about to update store');
          
          store.update(state => {
              console.log('Updating store with threads, current showThreadList:', state.showThreadList);
              return {
                  ...state,
                  threads,
                  isThreadsLoaded: true,
                  updateStatus: 'Threads loaded successfully'
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
        store.update(state => ({ ...state, messages, currentThreadId: threadId }));
        return messages;
      } catch (error) {
        console.error('Error loading messages:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to load messages' }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return [];
      }
    },


    addThread: async (threadData: Partial<Threads>): Promise<Threads | null> => {
      try {
          const newThread = await createThread(threadData);
          
          // If this is a project thread, fetch only threads for that project
          if (newThread.project_id) {
              const projectThreads = await fetchThreadsForProject(newThread.project_id);
              store.update(state => ({
                  ...state,
                  threads: projectThreads,
                  isThreadsLoaded: true,
                  updateStatus: 'Thread added successfully'
              }));
          } else {
              // For non-project threads, fetch all threads
              const updatedThreads = await fetchThreads();
              store.update(state => ({
                  ...state,
                  threads: updatedThreads,
                  isThreadsLoaded: true,
                  updateStatus: 'Thread added successfully'
              }));
          }
          
          setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
          return newThread;
      } catch (error) {
          console.error('Error adding thread:', error);
          store.update(state => ({ ...state, updateStatus: 'Failed to add thread' }));
          setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
          return null;
      }
  },
  updateThread: async (id: string, changes: Partial<Threads>) => {
    try {
      console.log('Attempting to update thread:', id, 'with changes:', changes);
      const updatedThread = await updateThread(id, changes);
      console.log('Thread updated successfully:', updatedThread);
      
      store.update(state => ({
        ...state,
        threads: state.threads.map(t => t.id === id ? { ...t, ...updatedThread } : t),
        updateStatus: 'Thread updated successfully'
      }));
      
      console.log('Store updated with new thread data');
      return updatedThread;
    } catch (error) {
      console.error('Failed to update thread in backend:', error);
      store.update(state => ({ ...state, updateStatus: 'Failed to update thread' }));
      throw error;
    }
  },
  setSearchQuery: (query: string) => {
    store.update(state => ({
      ...state,
      searchQuery: query
    }));
  },

  setSelectedTags: (tagIds: string[]) => {
    store.update(state => ({
      ...state,
      selectedTagIds: new Set(tagIds)
    }));
  },
  toggleTagSelection: (tagId: string) => {
    store.update(state => {
      const currentTags = state.selectedTagIds;
      const newSelectedTags = new Set(currentTags);
      
      console.log('Toggle tag:', tagId);
      console.log('Before toggle:', Array.from(newSelectedTags));
      
      if (newSelectedTags.has(tagId)) {
        newSelectedTags.delete(tagId);
      } else {
        newSelectedTags.add(tagId);
      }
      
      console.log('After toggle:', Array.from(newSelectedTags));
      
      // Create a new state object to ensure reactivity
      return {
        ...state,
        selectedTagIds: newSelectedTags
      };
    });
  },

  autoUpdateThreadName: async (threadId: string, messages: Messages[], model: AIModel, userId: string) => {
    try {
      store.update(state => ({ ...state, namingThreadId: threadId }));

      const updatedThread = await autoUpdateThreadName(threadId, messages, model, userId);
      
      store.update(state => ({
        ...state,
        threads: state.threads.map(t => 
          t.id === threadId ? { ...t, ...updatedThread } : t
        ),
        updateStatus: 'Thread name updated automatically',
        namingThreadId: null 
      }));

      setTimeout(() => store.update(state => ({ 
        ...state, 
        updateStatus: '' 
      })), 3000);

      return updatedThread;
    } catch (error) {
      console.error('Error in autoUpdateThreadName:', error);
      store.update(state => ({ 
        ...state, 
        updateStatus: 'Failed to auto-update thread name',
        namingThreadId: null  
      }));
      setTimeout(() => store.update(state => ({ 
        ...state, 
        updateStatus: '' 
      })), 3000);
      return null;
    }
  },
    
    // Add a new function to get the current thread
    getCurrentThread: derived(store, $store => 
      $store.threads.find(t => t.id === $store.currentThreadId) || null
    ),
    getShowThreadList: derived({ subscribe }, $state => $state.showThreadList),
    // getCurrentThread: derived(store, $store => {
    //   return $store.threads.find(t => t.id === $store.currentThreadId) || null;
    // }),
    addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>): Promise<Messages | null> => {
      try {
        const newMessage = await addMessageToThread(message);
        store.update(state => ({
          ...state,
          messages: [...state.messages, newMessage],
          updateStatus: 'Message added successfully'
        }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return newMessage;
      } catch (error) {
        console.error('Error adding message:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to add message' }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return null;
      }
    },
    
    setCurrentThread: async (id: string | null) => {
      if (id) {
        // Load messages for the new thread
        try {
          const messages = await fetchMessagesForThread(id);
          store.update(state => ({
            ...state,
            currentThreadId: id,
            messages,
            updateStatus: 'Current thread updated'
          }));
        } catch (error) {
          console.error('Error loading messages for thread:', error);
          store.update(state => ({
            ...state,
            currentThreadId: id,
            updateStatus: 'Error loading messages'
          }));
        }
      } else {
        // Only clear messages when explicitly setting to null
        store.update(state => ({
          ...state,
          currentThreadId: null,
          messages: [],
          updateStatus: 'Thread selection cleared'
        }));
      }
    },
    setNamingThreadId: (threadId: string | null) => {
      store.update(state => ({
        ...state,
        namingThreadId: threadId
      }));
    },
    reset: () => {
      store.update(state => ({
        ...state,
        currentThreadId: null,
        messages: [],
        updateStatus: '',
        isThreadsLoaded: false
      }));
      
      // Also clear URL parameters
      if (browser) {
        const url = new URL(window.location.href);
        url.searchParams.delete('threadId');
        url.searchParams.delete('messageId');
        url.searchParams.delete('autoTrigger');
        window.history.replaceState({}, '', url);
      }
    },

    clearCurrentThread: () => {
      store.update(state => ({
        ...state,
        currentThreadId: null,
        messages: [],
        updateStatus: 'Thread selection cleared'
      }));
    },
    
    addTag: (tagName: string) => {
      store.update(state => {
        const newTag: Tag = {
          id: crypto.randomUUID(), // Generate a unique ID
          name: tagName,
          color: '#000000', // Default color
          selected_threads: [], // Empty array of selected threads
          user: '', // This should probably be the current user's ID
          collectionId: '', // Required by RecordModel
          collectionName: '', // Required by RecordModel
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };
        return { ...state, tags: [...state.tags, newTag] };
      });
    },
    updateTag: (index: number, newName: string) => {
      store.update(state => {
        const updatedTags = [...state.tags];
        updatedTags[index].name = newName;
        return { ...state, tags: updatedTags };
      });
    },
    toggleTag: (index: number) => {
      store.update(state => {
        const updatedTags = [...state.tags];
        updatedTags[index].selected = !updatedTags[index].selected;
        return { ...state, tags: updatedTags };
      });
    },
    addTagToThread: (threadId: string, tagName: string) => {
      store.update(state => {
        const updatedThreads = state.threads.map(thread => {
          if (thread.id === threadId) {
            const updatedTags = [...new Set([...(thread.tags || []), tagName])];
            return { ...thread, tags: updatedTags };
          }
          return thread;
        });
        return { ...state, threads: updatedThreads };
      });
      const thread = get(store).threads.find(t => t.id === threadId);
      if (thread) {
        debouncedUpdateThread(threadId, { tags: thread.tags });
      }
    },
    removeTagFromThread: (threadId: string, tagName: string) => {
      store.update(state => {
        const updatedThreads = state.threads.map(thread => {
          if (thread.id === threadId) {
            const updatedTags = (thread.tags || []).filter(tag => tag !== tagName);
            return { ...thread, tags: updatedTags };
          }
          return thread;
        });
        return { ...state, threads: updatedThreads };
      });
      const thread = get(store).threads.find(t => t.id === threadId);
      if (thread) {
        debouncedUpdateThread(threadId, { tags: thread.tags });
      }
    },

    
    getThreadById: (id: string) => derived(store, $store => {
      return $store.threads.find(t => t.id === id) || null;
    }),
    
    getMessagesByDate: derived(store, $store => {
      const groups: { [key: string]: Messages[] } = {};
      $store.messages.forEach(message => {
        const date = new Date(message.created).toLocaleDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(message);
      });
      return Object.entries(groups).map(([date, messages]) => ({ date, messages }));
    }),

    // Modify the derived store for searched threads
    getSearchedThreads: derived(store, $store => {
      const query = $store.searchQuery.toLowerCase().trim();
      if (!query) return $store.threads;

      return $store.threads.filter(thread => 
        thread.name?.toLowerCase().includes(query) || 
        thread.last_message?.content?.toLowerCase().includes(query)
      );
    }),

    // Add a new derived store to check if search is active
    isSearchActive: derived(store, $store => 
      $store.searchQuery.trim().length > 0
    ),

    getUniqueTags: derived(store, $store => {
      const allTags = $store.threads.flatMap(thread => thread.tags || []);
      return [...new Set(allTags)];
    }),
    
    getFilteredThreads: derived(store, $store => {
      const selectedTags = $store.selectedTagIds;
      
      // If no tags selected, return all threads
      if (selectedTags.size === 0) {
        return $store.threads;
      }
    
      // Filter threads that have any of the selected tags
      return $store.threads.filter(thread => 
        thread.tags?.some(tag => selectedTags.has(tag))
      );
    }),

    isThreadsLoaded: derived(store, $store => $store.isThreadsLoaded)
};

  

  
}



export const threadsStore = createThreadsStore();

// Utility function to use the store outside of Svelte components
export function getThreadsStore() {
  return get(threadsStore);
}