import { writable, derived } from 'svelte/store';
import type { InternalChatMessage, Messages } from '$lib/types/types';

interface ChatState {
	messages: InternalChatMessage[];
	userInput: string;
	isTypingInProgress: boolean;
	typingMessageId: string | null;
	thinkingMessageId: string | null;
	thinkingPhrase: string;
	activeReplyMenu: {
		elementId: string;
		position: { x: number; y: number };
	} | null;
	replyText: string;
	quotedMessage: Messages | null;
	messageIdCounter: number;
	lastMessageCount: number;
	latestMessageId: string | null;
	isLoadingMessages: boolean;
	initialLoadComplete: boolean;
	activeSelection: string;
}

const initialChatState: ChatState = {
	messages: [],
	userInput: '',
	isTypingInProgress: false,
	typingMessageId: null,
	thinkingMessageId: null,
	thinkingPhrase: '',
	activeReplyMenu: null,
	replyText: '',
	quotedMessage: null,
	messageIdCounter: 0,
	lastMessageCount: 0,
	latestMessageId: null,
	isLoadingMessages: false,
	initialLoadComplete: false,
	activeSelection: ''
};

function createChatStore() {
	const { subscribe, set, update } = writable<ChatState>(initialChatState);

	return {
		subscribe,
		set,
		update,

		// Message operations
		addMessage: (message: InternalChatMessage) => {
			update((state) => ({
				...state,
				messages: [...state.messages, message],
				messageIdCounter: state.messageIdCounter + 1,
				latestMessageId: message.id
			}));
		},

		updateMessage: (messageId: string, updates: Partial<InternalChatMessage>) => {
			update((state) => ({
				...state,
				messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
			}));
		},

		removeMessage: (messageId: string) => {
			update((state) => ({
				...state,
				messages: state.messages.filter((msg) => msg.id !== messageId)
			}));
		},

		// Input operations
		setUserInput: (input: string) => {
			update((state) => ({ ...state, userInput: input }));
		},

		clearUserInput: () => {
			update((state) => ({ ...state, userInput: '' }));
		},

		// Typing operations
		setTypingInProgress: (isTyping: boolean) => {
			update((state) => ({ ...state, isTypingInProgress: isTyping }));
		},

		setTypingMessageId: (messageId: string | null) => {
			update((state) => ({ ...state, typingMessageId: messageId }));
		},

		setThinkingMessageId: (messageId: string | null) => {
			update((state) => ({ ...state, thinkingMessageId: messageId }));
		},

		setThinkingPhrase: (phrase: string) => {
			update((state) => ({ ...state, thinkingPhrase: phrase }));
		},

		// Reply operations
		setActiveReplyMenu: (menu: ChatState['activeReplyMenu']) => {
			update((state) => ({ ...state, activeReplyMenu: menu }));
		},

		setReplyText: (text: string) => {
			update((state) => ({ ...state, replyText: text }));
		},

		setQuotedMessage: (message: Messages | null) => {
			update((state) => ({ ...state, quotedMessage: message }));
		},

		// Selection operations
		setActiveSelection: (selection: string) => {
			update((state) => ({ ...state, activeSelection: selection }));
		},

		// Loading operations
		setLoadingMessages: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoadingMessages: isLoading }));
		},

		setInitialLoadComplete: (complete: boolean) => {
			update((state) => ({ ...state, initialLoadComplete: complete }));
		},

		// Bulk operations
		setMessages: (messages: InternalChatMessage[]) => {
			update((state) => ({ ...state, messages }));
		},

		// Reset operations
		reset: () => {
			set(initialChatState);
		},

		resetMessages: () => {
			update((state) => ({ ...state, messages: [], messageIdCounter: 0 }));
		}
	};
}

export const chatStore = createChatStore();

// Derived stores for easy access
export const chatMessages = derived(chatStore, ($store) => $store.messages);
export const userInput = derived(chatStore, ($store) => $store.userInput);
export const isTypingInProgress = derived(chatStore, ($store) => $store.isTypingInProgress);
export const typingMessageId = derived(chatStore, ($store) => $store.typingMessageId);
export const thinkingMessageId = derived(chatStore, ($store) => $store.thinkingMessageId);
export const activeReplyMenu = derived(chatStore, ($store) => $store.activeReplyMenu);
export const quotedMessage = derived(chatStore, ($store) => $store.quotedMessage);
export const isLoadingMessages = derived(chatStore, ($store) => $store.isLoadingMessages);
