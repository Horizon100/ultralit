import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chatStore';
import { messagesStore } from '$lib/stores/messagesStore';
import { currentUser } from '$lib/pocketbase';
import { fetchAIResponse } from '$lib/clients/aiClient';
import { processMarkdown } from '$lib/features/ai/utils/markdownProcessor';
import type {
	InternalChatMessage,
	AIModel,
	RoleType,
	ProviderType,
	PromptType,
	Scenario,
	Task,
	Messages
} from '$lib/types/types';

export class MessageService {
	/**
	 * Creates a new message object with proper structure
	 */
	static createMessage(
		role: RoleType,
		content: string | Scenario[] | Task[],
		parentMsgId: string | null = null,
		model: string = 'default',
		userId: string,
		provider: ProviderType = 'openai',
		selectedModelLabel: string = ''
	): InternalChatMessage {
		const store = get(chatStore);
		const messageCounter = store.messageIdCounter + 1;
		let messageContent = typeof content === 'string' ? content : JSON.stringify(content);

		// Add prompt information for assistant messages
		if (role === 'assistant') {
			const user = get(currentUser);
			const promptParts = [];

			if (user?.sysprompt_preference) {
				if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
					promptParts.push(`System: ${user.sysprompt_preference}`);
				} else {
					promptParts.push('System: Custom');
				}
			}

			if (
				user?.prompt_preference &&
				Array.isArray(user.prompt_preference) &&
				user.prompt_preference.length > 0
			) {
				promptParts.push('User: Custom');
			}

			if (promptParts.length > 0) {
				messageContent = `[Prompts: ${promptParts.join(', ')}]\n${messageContent}`;
			}
		}

		const newMessageId = `msg-${messageCounter}`;
		const createdDate = new Date().toISOString();

		return {
			id: newMessageId,
			role,
			content: messageContent,
			text: messageContent,
			user: userId,
			isTyping: role === 'assistant',
			collectionId: '',
			collectionName: '',
			created: createdDate,
			updated: createdDate,
			parent_msg: parentMsgId,
			prompt_type: null,
			prompt_input: null,
			model: selectedModelLabel || model,
			provider,
			reactions: {
				upvote: 0,
				downvote: 0,
				bookmark: [],
				highlight: [],
				question: 0
			}
		};
	}

	/**
	 * Adds a message to the chat store
	 */
	static addMessage(message: InternalChatMessage): void {
		chatStore.addMessage(message);
	}

	/**
	 * Types out a message character by character
	 */
	static async typeMessage(
		messageId: string,
		fullMessage: string,
		typingSpeed: number = 1
	): Promise<void> {
		chatStore.setTypingInProgress(true);

		const store = get(chatStore);
		const typingMessage = store.messages.find((msg) => msg.id === messageId);

		if (!typingMessage) {
			console.error('Typing message not found:', messageId);
			chatStore.setTypingInProgress(false);
			return;
		}

		try {
			// Split message into chunks for better performance
			const messageLength = fullMessage.length;
			const chunkSize = Math.max(10, Math.floor(messageLength / 20));

			for (let i = chunkSize; i <= messageLength; i += chunkSize) {
				const typedMessage = fullMessage.slice(0, i);

				chatStore.updateMessage(messageId, {
					content: typedMessage,
					text: typedMessage,
					isTyping: true
				});

				// Small delay between updates
				await new Promise((resolve) => setTimeout(resolve, typingSpeed * chunkSize));
			}

			// Final update to complete the message
			chatStore.updateMessage(messageId, {
				content: fullMessage,
				text: fullMessage,
				isTyping: false
			});
		} catch (error) {
			console.error('Error typing message:', error);

			// Ensure message is updated even if there's an error
			chatStore.updateMessage(messageId, {
				content: fullMessage,
				text: fullMessage,
				isTyping: false
			});
		} finally {
			chatStore.setTypingInProgress(false);
		}
	}

	/**
	 * Processes message content to add replyable elements
	 */
	static async processMessageContentWithReplyable(
		content: string,
		messageId: string
	): Promise<string> {
		if (!content || typeof content !== 'string') return content || '';

		// First, process markdown to HTML
		let htmlContent: string;
		try {
			htmlContent = await processMarkdown(content);
		} catch (error) {
			console.error('Error processing markdown:', error);
			htmlContent = content; // Fallback to original content
		}

		// Create a temporary element to process the HTML content
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = htmlContent;

		// Add data attributes to elements that can be replied to
		const replyableElements = tempDiv.querySelectorAll(
			'p, li, ul, ol, blockquote, pre, code, strong, em'
		);

		replyableElements.forEach((el) => {
			if (!el.id) {
				el.id = `replyable-${Math.random().toString(36).slice(2, 10)}`;
			}
			el.setAttribute('data-parent-msg', messageId);
			el.classList.add('replyable');
		});

		return tempDiv.innerHTML;
	}

	/**
	 * Handles sending a new message
	 */
	static async sendMessage(
		content: string,
		aiModel: AIModel,
		userId: string,
		currentThreadId: string,
		promptType: PromptType,
		attachment?: File | null,
		selectedModelLabel: string = '',
		quotedMessage?: Messages
	): Promise<{ userMessage: Messages; assistantMessage?: Messages }> {
		if (!content.trim()) {
			throw new Error('Message content is required');
		}

		// Create user message UI
		const userMessageUI = this.createMessage(
			'user',
			content,
			quotedMessage?.id ?? null,
			aiModel.id,
			userId,
			aiModel.provider,
			selectedModelLabel
		);

		const tempUserMsgId = `temp-user-${Date.now()}`;
		userMessageUI.tempId = tempUserMsgId;

		this.addMessage(userMessageUI);

		// Save user message to database
		const userMessage = await messagesStore.saveMessage(
			{
				text: content,
				type: 'human',
				thread: currentThreadId,
				parent_msg: quotedMessage?.id ?? null,
				prompt_type: promptType,
				tempId: tempUserMsgId
			},
			currentThreadId
		);

		// Update UI message with real ID
		chatStore.updateMessage(userMessageUI.id, {
			id: userMessage.id,
			tempId: undefined
		});

		return { userMessage };
	}

	/**
	 * Handles AI response generation and display
	 */
	static async generateAIResponse(
		userMessage: Messages,
		aiModel: AIModel,
		userId: string,
		currentThreadId: string,
		promptType: PromptType,
		attachment?: File | null,
		selectedModelLabel: string = ''
	): Promise<Messages> {
		// Add thinking message
		const thinkingMessage = this.createMessage('thinking', '', undefined, undefined, userId);
		chatStore.setThinkingMessageId(thinkingMessage.id);
		this.addMessage(thinkingMessage);

		try {
			// Prepare messages for AI
			const store = get(chatStore);
			const messagesToSend = store.messages
				.filter(({ role, content }) => role && content && role !== 'thinking')
				.map(({ role, content }) => ({
					role,
					content: content.toString(),
					model: aiModel.api_type,
					provider: aiModel.provider
				}));

			// Get AI response
			const aiResponse = await fetchAIResponse(messagesToSend, aiModel, userId, attachment);

			// Remove thinking message
			chatStore.removeMessage(thinkingMessage.id);

			// Get prompt input for assistant message
			const user = get(currentUser);
			let promptInput = null;

			if (user?.prompt_preference) {
				let promptId: string | null = null;

				if (Array.isArray(user.prompt_preference) && user.prompt_preference.length > 0) {
					promptId = user.prompt_preference[0];
				} else if (typeof user.prompt_preference === 'string') {
					promptId = user.prompt_preference;
				}

				if (promptId) {
					try {
						const response = await fetch(`/api/prompts/${promptId}`);
						if (response.ok) {
							const promptData = await response.json();
							promptInput = promptData.data?.prompt || promptData.prompt;
						}
					} catch (error) {
						console.error('Error fetching user prompt:', error);
					}
				}
			}

			// Save assistant message to database
			const tempAssistantMsgId = `temp-assistant-${Date.now()}`;
			const assistantMessage = await messagesStore.saveMessage(
				{
					text: aiResponse,
					type: 'robot',
					thread: currentThreadId,
					parent_msg: userMessage.id,
					prompt_type: promptType,
					prompt_input: promptInput,
					model: aiModel.api_type,
					tempId: tempAssistantMsgId
				},
				currentThreadId
			);

			// Create assistant message UI
			const newAssistantMessage = this.createMessage(
				'assistant',
				'',
				userMessage.id,
				undefined,
				userId,
				aiModel.provider,
				selectedModelLabel
			);
			newAssistantMessage.tempId = tempAssistantMsgId;
			newAssistantMessage.serverId = assistantMessage.id;

			this.addMessage(newAssistantMessage);
			chatStore.setTypingMessageId(newAssistantMessage.id);

			// Type out the message
			await this.typeMessage(newAssistantMessage.id, aiResponse);

			// Update with final content
			chatStore.updateMessage(newAssistantMessage.id, {
				id: assistantMessage.id,
				content: aiResponse,
				text: aiResponse,
				isTyping: false,
				tempId: undefined
			});

			return assistantMessage;
		} catch (error) {
			// Remove thinking message on error
			chatStore.removeMessage(thinkingMessage.id);
			throw error;
		}
	}

	/**
	 * Handles replying to a specific message
	 */
	static async replyToMessage(
		replyText: string,
		parentMessageId: string,
		aiModel: AIModel,
		userId: string,
		currentThreadId: string,
		promptType: PromptType,
		attachment?: File | null
	): Promise<void> {
		if (!replyText.trim()) return;

		// Add user reply message
		const userMessageUI = this.createMessage(
			'user',
			replyText,
			parentMessageId,
			aiModel.id,
			userId,
			aiModel.provider
		);
		this.addMessage(userMessageUI);

		// Save user message to database
		const userMessage = await messagesStore.saveMessage(
			{
				text: replyText,
				type: 'human',
				thread: currentThreadId,
				parent_msg: parentMessageId || null,
				prompt_type: promptType
			},
			currentThreadId
		);

		// Generate AI response for the reply
		await this.generateAIResponse(
			userMessage,
			aiModel,
			userId,
			currentThreadId,
			promptType,
			attachment
		);
	}

	/**
	 * Deduplicates chat messages
	 */
	static dedupeMessages(messages: InternalChatMessage[]): InternalChatMessage[] {
		const uniqueMessages: InternalChatMessage[] = [];
		const seenIds = new Set<string>();

		messages.forEach((message) => {
			if (!seenIds.has(message.id)) {
				seenIds.add(message.id);
				uniqueMessages.push(message);
			}
		});

		return uniqueMessages;
	}

	/**
	 * Clears all messages from the store
	 */
	static clearMessages(): void {
		chatStore.resetMessages();
	}

	/**
	 * Sets all messages in the store
	 */
	static setMessages(messages: InternalChatMessage[]): void {
		chatStore.setMessages(messages);
	}

	/**
	 * Applies deduplication to current messages in store
	 */
	static dedupeCurrentMessages(): void {
		const store = get(chatStore);
		const deduped = this.dedupeMessages(store.messages);
		chatStore.setMessages(deduped);
	}
}
