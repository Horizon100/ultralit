import { writable, get } from 'svelte/store';
import type { Messages } from '$lib/types/types';
import { fetchMessagesForThread, addMessageToThread, fetchMessagesForBookmark, updateMessage } from '$lib/clients/threadsClient';
import { threadsStore } from './threadsStore';
import { currentUser, pocketbaseUrl } from '$lib/pocketbase';

function createMessagesStore() {
  const store = writable<{
    messages: Messages[];
    currentThreadId: string | null;
    selectedDate: string | null;
  }>({
    messages: [],
    currentThreadId: null,
    selectedDate: null
  });
  
  let activeSubscriptions: Record<string, () => void> = {};
  
  const { subscribe, set, update } = store;

  // This is a placeholder since real-time subscriptions should be handled differently
  // without direct access to the PocketBase instance
  const subscribeToThread = async (threadId: string) => {
    if (activeSubscriptions[threadId]) {
      try {
        if (typeof activeSubscriptions[threadId] === 'function') {
          activeSubscriptions[threadId]();
        }
        delete activeSubscriptions[threadId];
      } catch (err) {
        console.error('Error unsubscribing from thread:', err);
      }
    }
    
    console.log(`Setting up alternative for real-time updates for thread ${threadId}`);
    
    // In a real implementation, you might set up a WebSocket connection or use SSE
    // For now, we'll use a polling mechanism as a fallback
    const pollInterval = setInterval(async () => {
      try {
        const messages = await fetchMessagesForThread(threadId);
        update(state => ({ ...state, messages }));
      } catch (err) {
        console.error('Error polling for messages:', err);
      }
    }, 10000); // Poll every 10 seconds
    
    // Return a function to clear the interval when unsubscribing
    activeSubscriptions[threadId] = () => clearInterval(pollInterval);
    return activeSubscriptions[threadId];
  };

  return {
    subscribe,
    
    setSelectedDate: (date: string | null) => {
      update((state) => ({ ...state, selectedDate: date }));
    },
    
    setMessages: (messages: Messages[]) => {
      update(state => ({ ...state, messages: messages || [] }));
    },
    
    addMessage: async (message: Omit<Messages, 'id' | 'created' | 'updated'>) => {
      try {
        const newMessage = await addMessageToThread(message);
        update((state) => ({
          ...state,
          messages: [...state.messages, newMessage]
        }));
        
        if (message.thread) {
          threadsStore.loadThreads().catch(err => {
            console.error('Error loading threads after adding message:', err);
          });
        }
        
        return newMessage;
      } catch (error) {
        console.error('Error adding message:', error);
        throw error;
      }
    },
    
    updateMessage: async (id: string, data: Partial<Messages>) => {
      try {
        const updatedMessage = await updateMessage(id, data);
        update((state) => ({
          ...state,
          messages: state.messages.map(msg => msg.id === id ? { ...msg, ...data } : msg)
        }));
        return updatedMessage;
      } catch (error) {
        console.error('Error updating message:', error);
        throw error;
      }
    },
    
    fetchMessages: async (threadId: string) => {
      try {
          const currentState = get(store);
          if (currentState.currentThreadId === threadId && currentState.messages.length > 0) {
              console.log('Skipping fetch - already have messages for this thread');
              return currentState.messages;
          }
  
          console.log(`Fetching messages for thread ${threadId}`);
          const messages = await fetchMessagesForThread(threadId);
          
          update(state => ({
              ...state,
              messages: messages || [],
              currentThreadId: threadId
          }));
          
          return messages;
      } catch (error) {
          console.error('Error fetching messages:', error);
          throw error;
      }
  },
    
    saveMessage: async (message: Partial<Messages>, threadId: string) => {
      try {
        // Get user from store properly using get()
        const user = get(currentUser);
        if (!user || !user.id) {
          throw new Error('User not authenticated');
        }
    
        const userId = user.id;
    
        const newMessage: Omit<Messages, 'id' | 'created' | 'updated'> = {
          text: message.text || '',
          user: userId,
          parent_msg: message.parent_msg || null,
          task_relation: message.task_relation || null,
          agent_relation: message.agent_relation || null,
          type: message.type || 'human',
          read_by: [userId],
          thread: threadId,
          attachments: message.attachments || '',
          prompt_type: message.prompt_type || null,
          model: message.model || 'fail'
        };
    
        // addMessageToThread already updates the thread timestamp
        const savedMessage = await addMessageToThread(newMessage);
        
        update((state) => ({
          ...state,
          messages: [...state.messages, savedMessage]
        }));

        
        return savedMessage;
      } catch (error) {
        console.error('Error saving message:', error);
        throw error;
      }
    },
    
    fetchBookmarkedMessages: async (messageId: string) => {
      try {
        const messages = await fetchMessagesForBookmark(messageId);
        update(state => ({ ...state, messages: messages || [] }));
        return messages;
      } catch (error) {
        console.error('Error fetching bookmarked messages:', error);
        update(state => ({ ...state, messages: [] }));
        throw error;
      }
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
      
      update(state => ({
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
      
      update(state => ({
        ...state,
        messages: [],
        currentThreadId: null
      }));
    }
  };
}

export const messagesStore = createMessagesStore();