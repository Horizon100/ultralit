import { writable, get } from 'svelte/store';
import type { Messages } from '$lib/types/types';
import { pb } from '$lib/pocketbase';
import { fetchMessagesForThread, addMessageToThread, fetchMessagesForBookmark, updateMessage} from '$lib/clients/threadsClient';
import { threadsStore } from './threadsStore';

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
  
  console.log(`Subscribing to real-time updates for thread ${threadId}`);
  
  try {
    const unsubscribe = await pb.collection('messages').subscribe('*', async function(data) {
      if (!data || !data.record) return;
      
      if (data.record.thread === threadId) {
        console.log('Message update received:', data);
        
        try {
          const messages = await fetchMessagesForThread(threadId);
          update(state => ({ ...state, messages }));
        } catch (err) {
          console.error('Error refreshing messages after update:', err);
        }
      }
    });
    
    if (typeof unsubscribe === 'function') {
      activeSubscriptions[threadId] = unsubscribe;
      return unsubscribe;
    } else {
      console.error('PocketBase subscribe did not return a function:', unsubscribe);
      return () => {}; 
    }
  } catch (error) {
    console.error('Error setting up real-time subscription:', error);
    return () => {};
  }
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
        console.log(`Fetching messages for thread ${threadId}`);
        const messages = await fetchMessagesForThread(threadId);
        
        update(state => ({
          ...state,
          messages: messages || [],
          currentThreadId: threadId
        }));
        
        // Set up real-time subscription for this thread
        subscribeToThread(threadId);
        
        return messages;
      } catch (error) {
        console.error('Error fetching messages:', error);
        update(state => ({ ...state, messages: [] }));
        throw error;
      }
    },
    
    saveMessage: async (message: Partial<Messages>, threadId: string) => {
      try {
        if (!pb.authStore.isValid) {
          throw new Error('User is not authenticated');
        }

        const userId = pb.authStore.model?.id;
        if (!userId) {
          throw new Error('User ID not found');
        }

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

        const savedMessage = await addMessageToThread(newMessage);
        
        update((state) => ({
          ...state,
          messages: [...state.messages, savedMessage]
        }));
        
        // Don't call threadsStore.loadThreads() here as it's causing the 400 error
        // Instead, just update the current thread's updated timestamp
        const thread = await pb.collection('threads').getOne(threadId);
        await pb.collection('threads').update(threadId, {
          updated: new Date().toISOString()
        });
        
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