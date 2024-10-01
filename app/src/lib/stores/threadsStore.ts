import { writable, derived, get } from 'svelte/store';
import type { Messages, Threads, Tag } from '$lib/types';
import { debounce } from 'lodash-es';
import { fetchThreads, fetchMessagesForThread, createThread, updateThread, addMessageToThread } from '$lib/threadsClient';
import { browser } from '$app/environment';

function createThreadsStore() {
  const initialThreads = browser ? JSON.parse(localStorage.getItem('userThreads') || '[]') : [];
  const initialCurrentThreadId = browser ? localStorage.getItem('currentThreadId') || null : null;
  const initialTags = browser ? JSON.parse(localStorage.getItem('userTags') || '[]') : [];
  
  const store = writable<{
    threads: Threads[],
    currentThreadId: string | null,
    messages: Messages[],
    updateStatus: string,
    tags: Tag[]
  }>({
    threads: initialThreads,
    currentThreadId: initialCurrentThreadId,
    messages: [],
    updateStatus: '',
    tags: initialTags
  });
  
  if (browser) {
    store.subscribe(state => {
      localStorage.setItem('userThreads', JSON.stringify(state.threads));
      localStorage.setItem('userTags', JSON.stringify(state.tags));
      if (state.currentThreadId) {
        localStorage.setItem('currentThreadId', state.currentThreadId);
      } else {
        localStorage.removeItem('currentThreadId');
      }
    });
  }

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
    subscribe: store.subscribe,
    loadThreads: async (): Promise<Threads[]> => {
      try {
        const threads = await fetchThreads();
        store.update(state => ({
          ...state,
          threads,
          currentThreadId: state.currentThreadId || (threads.length > 0 ? threads[0].id : null),
          updateStatus: 'Threads loaded successfully'
        }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return threads;
      } catch (error) {
        console.error('Error loading threads:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to load threads' }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return [];
      }
    },
    loadMessages: async (threadId: string): Promise<Messages[]> => {
      try {
        const messages = await fetchMessagesForThread(threadId);
        store.update(state => ({ ...state, messages }));
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
        store.update(state => ({
          ...state,
          threads: [...state.threads, newThread],
          updateStatus: 'Thread added successfully'
        }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return newThread;
      } catch (error) {
        console.error('Error adding thread:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to add thread' }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return null;
      }
    },
    updateThread: (id: string, changes: Partial<Threads>) => {
      debouncedUpdateThread(id, changes);
    },
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
    setCurrentThread: (id: string) => store.update(state => ({
      ...state,
      currentThreadId: id,
      updateStatus: 'Current thread updated'
    })),
    reset: () => store.set({ threads: [], currentThreadId: null, messages: [], updateStatus: '', tags: [] }),
    
    addTag: (tagName: string) => {
      store.update(state => {
        const newTag: Tag = { name: tagName, selected: false };
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
            return { ...thread, tags: [...(thread.tags || []), tagName] };
          }
          return thread;
        });
        return { ...state, threads: updatedThreads };
      });
      debouncedUpdateThread(threadId, { tags: get(store).threads.find(t => t.id === threadId)?.tags || [] });
    },
    removeTagFromThread: (threadId: string, tagName: string) => {
      store.update(state => {
        const updatedThreads = state.threads.map(thread => {
          if (thread.id === threadId) {
            return { ...thread, tags: (thread.tags || []).filter(tag => tag !== tagName) };
          }
          return thread;
        });
        return { ...state, threads: updatedThreads };
      });
      debouncedUpdateThread(threadId, { tags: get(store).threads.find(t => t.id === threadId)?.tags || [] });
    },
    
    getCurrentThread: derived(store, $store => {
      return $store.threads.find(t => t.id === $store.currentThreadId) || null;
    }),
    
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

    getFilteredThreads: derived(store, $store => {
      const selectedTags = $store.tags.filter(tag => tag.selected).map(tag => tag.name);
      if (selectedTags.length === 0) {
        return $store.threads;
      }
      return $store.threads.filter(thread => 
        selectedTags.every(tag => thread.tags?.includes(tag))
      );
    })
  };
}

export const threadsStore = createThreadsStore();

// Utility function to use the store outside of Svelte components
export function getThreadsStore() {
  return get(threadsStore);
}