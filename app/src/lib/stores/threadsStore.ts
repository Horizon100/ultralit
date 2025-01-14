import { writable, derived, get } from 'svelte/store';
import type { Messages, Threads, AIModel } from '$lib/types';
import { debounce } from 'lodash-es';
import { fetchThreads, fetchMessagesForThread, createThread, updateThread, addMessageToThread, autoUpdateThreadName } from '$lib/threadsClient';
import { fetchThreadsForProject } from '$lib/projectClient';
import { browser } from '$app/environment';
import { pb } from '$lib/pocketbase';

function createThreadsStore() {
  // Initialize store with localStorage value for threadList visibility if in browser
  const initialShowThreadList = browser ? 
    localStorage.getItem('threadListVisible') !== 'false' : 
    true;

  // Store state interface
  const store = writable<{
    threads: Threads[],
    currentThreadId: string | null,
    messages: Messages[],
    updateStatus: string,
    isThreadsLoaded: boolean,
    showThreadList: boolean,
    searchQuery: string,
    namingThreadId: string | null,
    date: string,
    error: string | null
  }>({
    threads: [],
    currentThreadId: null,
    messages: [],
    updateStatus: '',
    isThreadsLoaded: false,
    showThreadList: initialShowThreadList,
    searchQuery: '',
    namingThreadId: null,
    date: '',
    error: null
  });

  const { subscribe, update } = store;

  // Error handling utilities
  const clearError = () => {
    setTimeout(() => {
      update(state => ({ ...state, error: null }));
    }, 5000);
  };

  const handleError = (error: unknown, operation: string) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error during ${operation}:`, error);
    
    update(state => ({
      ...state,
      error: errorMessage,
      updateStatus: `Failed to ${operation}`
    }));

    clearError();
    throw error;
  };

  const checkAuthentication = () => {
    if (!pb.authStore.isValid) {
      const error = new Error('Authentication required - please log in again');
      handleError(error, 'authentication check');
    }
  };

  // Debounced thread update
  const debouncedUpdateThread = debounce(async (id: string, changes: Partial<Threads>) => {
    try {
      checkAuthentication();
      const updatedThread = await updateThread(id, changes);
      store.update(state => ({
        ...state,
        threads: state.threads.map(t => t.id === id ? { ...t, ...updatedThread } : t),
        updateStatus: 'Thread updated successfully',
        error: null
      }));
    } catch (error) {
      handleError(error, 'thread update');
    }
  }, 300);

  return {
    subscribe,
    update,

    // UI State Management
    toggleThreadList: () => {
      update(state => {
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

    setThreadListVisibility: (visible: boolean) => {
      if (browser) {
        localStorage.setItem('threadListVisible', String(visible));
      }
      update(state => ({
        ...state,
        showThreadList: visible
      }));
    },

    // Thread Operations
    loadThreads: async (): Promise<Threads[]> => {
      try {
        checkAuthentication();
        console.log('Starting loadThreads...');
        
        const threads = await fetchThreads();
        console.log('Fetched threads successfully');
        
        store.update(state => ({
          ...state,
          threads,
          isThreadsLoaded: true,
          updateStatus: 'Threads loaded successfully',
          error: null
        }));
        
        return threads;
      } catch (error) {
        return handleError(error, 'loading threads');
      }
    },

    loadMessages: async (threadId: string): Promise<Messages[]> => {
      try {
        checkAuthentication();
        const messages = await fetchMessagesForThread(threadId);
        store.update(state => ({ 
          ...state, 
          messages, 
          currentThreadId: threadId,
          error: null 
        }));
        return messages;
      } catch (error) {
        return handleError(error, 'loading messages');
      }
    },

    addThread: async (threadData: Partial<Threads>): Promise<Threads | null> => {
      try {
        checkAuthentication();
        const newThread = await createThread(threadData);
        const currentState = get(store);
        
        if (newThread.project_id) {
          const projectThreads = await fetchThreadsForProject(newThread.project_id);
          store.update(state => ({
            ...state,
            threads: projectThreads,
            isThreadsLoaded: true,
            updateStatus: 'Thread added successfully',
            showThreadList: currentState.showThreadList,
            error: null
          }));
        } else {
          const updatedThreads = await fetchThreads();
          store.update(state => ({
            ...state,
            threads: updatedThreads,
            isThreadsLoaded: true,
            updateStatus: 'Thread added successfully',
            showThreadList: currentState.showThreadList,
            error: null
          }));
        }
        
        return newThread;
      } catch (error) {
        return handleError(error, 'adding thread');
      }
    },

    updateThread: async (id: string, changes: Partial<Threads>) => {
      try {
        checkAuthentication();
        const updatedThread = await updateThread(id, changes);
        
        store.update(state => ({
          ...state,
          threads: state.threads.map(t => t.id === id ? { ...t, ...updatedThread } : t),
          updateStatus: 'Thread updated successfully',
          error: null
        }));
        
        return updatedThread;
      } catch (error) {
        return handleError(error, 'updating thread');
      }
    },

    // Message Operations
    addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>): Promise<Messages | null> => {
      try {
        checkAuthentication();
        const newMessage = await addMessageToThread(message);
        store.update(state => ({
          ...state,
          messages: [...state.messages, newMessage],
          updateStatus: 'Message added successfully',
          error: null
        }));
        return newMessage;
      } catch (error) {
        return handleError(error, 'adding message');
      }
    },

    // Thread Naming Operations
    autoUpdateThreadName: async (threadId: string, messages: Messages[], model: AIModel, userId: string) => {
      try {
        checkAuthentication();
        store.update(state => ({ ...state, namingThreadId: threadId }));

        const updatedThread = await autoUpdateThreadName(threadId, messages, model, userId);
        
        store.update(state => ({
          ...state,
          threads: state.threads.map(t => 
            t.id === threadId ? { ...t, ...updatedThread } : t
          ),
          updateStatus: 'Thread name updated automatically',
          namingThreadId: null,
          error: null
        }));

        return updatedThread;
      } catch (error) {
        return handleError(error, 'updating thread name');
      } finally {
        store.update(state => ({ ...state, namingThreadId: null }));
      }
    },

    setNamingThreadId: (threadId: string | null) => {
      update(state => ({
        ...state,
        namingThreadId: threadId
      }));
    },

    // Search Operations
    setSearchQuery: (query: string) => {
      update(state => ({
        ...state,
        searchQuery: query
      }));
    },

    // Thread Selection Operations
    setCurrentThread: async (id: string | null) => {
      try {
        if (id) {
          checkAuthentication();
          const messages = await fetchMessagesForThread(id);
          store.update(state => ({
            ...state,
            currentThreadId: id,
            messages,
            updateStatus: 'Current thread updated',
            error: null
          }));
        } else {
          store.update(state => ({
            ...state,
            currentThreadId: null,
            messages: [],
            updateStatus: 'Thread selection cleared'
          }));
        }
      } catch (error) {
        handleError(error, 'setting current thread');
      }
    },

    clearCurrentThread: () => {
      update(state => ({
        ...state,
        currentThreadId: null,
        messages: [],
        updateStatus: 'Thread selection cleared'
      }));
    },

    reset: () => {
      update(state => ({
        ...state,
        currentThreadId: null,
        messages: [],
        updateStatus: '',
        isThreadsLoaded: false,
        error: null
      }));
      
      if (browser) {
        const url = new URL(window.location.href);
        url.searchParams.delete('threadId');
        url.searchParams.delete('messageId');
        url.searchParams.delete('autoTrigger');
        window.history.replaceState({}, '', url);
      }
    },

    // Derived Stores
    getCurrentThread: derived(store, $store => 
      $store.threads.find(t => t.id === $store.currentThreadId) || null
    ),

    getShowThreadList: derived({ subscribe }, $state => $state.showThreadList),

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

    getSearchedThreads: derived(store, $store => {
      const query = $store.searchQuery.toLowerCase().trim();
      if (!query) return $store.threads;

      return $store.threads.filter(thread => 
        thread.name?.toLowerCase().includes(query) || 
        thread.last_message?.content?.toLowerCase().includes(query)
      );
    }),

    isSearchActive: derived(store, $store => 
      $store.searchQuery.trim().length > 0
    ),

    isThreadsLoaded: derived(store, $store => $store.isThreadsLoaded),
    
    getError: derived(store, $store => $store.error)
  };
}

export const threadsStore = createThreadsStore();

export function getThreadsStore() {
  return get(threadsStore);
}