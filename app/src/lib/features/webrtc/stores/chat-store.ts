// src/lib/stores/chat-store.ts
import { writable } from 'svelte/store';

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
    type: 'message' | 'system';
}

function createChatStore() {
    const { subscribe, update } = writable<ChatMessage[]>([]);

    return {
        subscribe,
        
        // Add a message
        addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
            update(messages => [...messages, {
                ...message,
                id: Date.now().toString(),
                timestamp: new Date()
            }]);
        },

        // Add system message
        addSystemMessage: (message: string) => {
            update(messages => [...messages, {
                id: Date.now().toString(),
                userId: 'system',
                userName: 'System',
                message,
                timestamp: new Date(),
                type: 'system'
            }]);
        },

        // Clear all messages
        clear: () => {
            update(() => []);
        }
    };
}

export const chatStore = createChatStore();