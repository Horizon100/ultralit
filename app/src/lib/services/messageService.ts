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
	AIProviderType,
	PromptType,
	Scenario,
	Task,
	Messages,
	SelectableAIModel
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
		provider: AIProviderType = 'openai',
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
		console.log('🔍 TYPE MESSAGE - Starting for:', messageId);
		console.log('🔍 TYPE MESSAGE - Full message length:', fullMessage.length);
		console.log('🔍 TYPE MESSAGE - Full message preview:', fullMessage.substring(0, 100));

		chatStore.setTypingInProgress(true);

		const store = get(chatStore);
		const typingMessage = store.messages.find((msg) => msg.id === messageId);

		if (!typingMessage) {
			console.error('❌ TYPE MESSAGE - Typing message not found:', messageId);
			console.error(
				'❌ TYPE MESSAGE - Available message IDs:',
				store.messages.map((m) => m.id)
			);
			chatStore.setTypingInProgress(false);
			return;
		}

		console.log('🔍 TYPE MESSAGE - Found message to type into:', typingMessage.id);

		try {
			// Split message into chunks for better performance
			const messageLength = fullMessage.length;
			const chunkSize = Math.max(10, Math.floor(messageLength / 20));

			console.log('🔍 TYPE MESSAGE - Using chunk size:', chunkSize);

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
			console.log('🔍 TYPE MESSAGE - Final update with full message');
			chatStore.updateMessage(messageId, {
				content: fullMessage,
				text: fullMessage,
				isTyping: false
			});

			console.log('🔍 TYPE MESSAGE - Completed successfully');
		} catch (error) {
			console.error('❌ TYPE MESSAGE - Error:', error);

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
	 * Enhanced generateAIResponse with comprehensive error handling and fallbacks
	 */
	static async generateAIResponse(
		userMessage: Messages,
		aiModel: AIModel | SelectableAIModel,
		userId: string,
		currentThreadId: string,
		promptType: PromptType,
		attachment?: File | null,
		selectedModelLabel: string = ''
	): Promise<Messages> {
		const thinkingMessage = this.createMessage('thinking', '', undefined, undefined, userId);
		chatStore.setThinkingMessageId(thinkingMessage.id);
		this.addMessage(thinkingMessage);

		try {
			const store = get(chatStore);
			const messagesToSend = store.messages
				.filter(({ role, content }) => role && content && role !== 'thinking')
				.map(({ role, content }) => ({
					role,
					content: content.toString(),
					model:
						'api_type' in aiModel
							? aiModel.api_type || aiModel.id || 'unknown'
							: aiModel.id || 'unknown',
					provider: aiModel.provider
				}));

			let aiResponse: string;
			let actualModel = aiModel;

			if (aiModel.provider === 'local') {
				console.log('🤖 Using local AI model directly');
				aiResponse = await this.fetchLocalAIResponse(
					messagesToSend,
					aiModel as SelectableAIModel,
					userId
				);
			} else {
				try {
					// Try API client first
					console.log('🤖 Attempting API provider:', aiModel.provider);
					aiResponse = await fetchAIResponse(
						messagesToSend,
						aiModel as AIModel,
						userId,
						attachment
					);
				} catch (error) {
					console.log('🤖 API provider failed, checking for fallback options...');

					// Check error type
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.log('🤖 Error message:', errorMessage);

					const isBillingError =
						errorMessage.includes('BILLING_ERROR') ||
						errorMessage.includes('credit balance') ||
						errorMessage.includes('billing') ||
						errorMessage.includes('quota') ||
						errorMessage.includes('rate limit') ||
						errorMessage.includes('insufficient credits');

					const isModelError =
						errorMessage.includes('MODEL_NOT_EXIST') ||
						errorMessage.includes('Model Not Exist') ||
						errorMessage.includes('model not found') ||
						errorMessage.includes('invalid model') ||
						errorMessage.includes('model does not exist');

					const isLocalRedirect = errorMessage.includes('LOCAL_MODEL_REDIRECT');

					if (isBillingError || isModelError || isLocalRedirect) {
						console.log('🤖 Recoverable error detected, attempting local fallback...');

						// Try to fallback to local model
						try {
							// Check if local models are available
							const localCheckResponse = await fetch('/api/ai/local/models');
							const localCheck = await localCheckResponse.json();

							if (localCheck.success && localCheck.data?.models?.length > 0) {
								console.log('🤖 Local models available, using fallback');

								// Use first available local model
								const localModel: SelectableAIModel = {
									id: localCheck.data.models[0].api_type,
									name: localCheck.data.models[0].name,
									provider: 'local' as AIProviderType,
									api_type: localCheck.data.models[0].api_type
								};

								actualModel = localModel;
								aiResponse = await this.fetchLocalAIResponse(messagesToSend, localModel, userId);

								// Add a note about the fallback with specific error type
								let fallbackReason = '';
								if (isBillingError) {
									fallbackReason = 'API credits exhausted';
								} else if (isModelError) {
									fallbackReason = 'requested model not available';
								} else {
									fallbackReason = 'API limitations';
								}

								aiResponse = `*[Using local model ${localModel.name} due to ${fallbackReason}]*\n\n${aiResponse}`;
							} else {
								throw new Error('Local AI server not available for fallback');
							}
						} catch (localError) {
							console.error('❌ Local fallback also failed:', localError);

							// Provide specific error messages based on the original error
							let userFriendlyMessage = '';
							if (isBillingError) {
								userFriendlyMessage =
									'API credits exhausted and local AI server is not available. Please add credits or start your local AI server (Ollama).';
							} else if (isModelError) {
								userFriendlyMessage =
									'The requested AI model is not available and local AI server is not available. Please try a different model or start your local AI server (Ollama).';
							} else {
								userFriendlyMessage =
									'API provider failed and local AI server is not available. Please check your setup.';
							}

							throw new Error(userFriendlyMessage);
						}
					} else {
						// Re-throw non-recoverable errors
						throw error;
					}
				}
			}

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
					model: 'api_type' in actualModel ? actualModel.api_type : actualModel.id,
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
				actualModel.provider,
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
	 * Enhanced sendMessage to work with both model types
	 */
	static async sendMessage(
		content: string,
		aiModel: AIModel | SelectableAIModel,
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
			'api_type' in aiModel ? aiModel.api_type : aiModel.id,
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
	 * Enhanced fetchLocalAIResponse with better error handling
	 */
	/**
	 * Enhanced fetchLocalAIResponse with improved response parsing
	 */
	static async fetchLocalAIResponse(
		messages: any[],
		model: SelectableAIModel,
		userId: string
	): Promise<string> {
		console.log('🤖 Sending request to local AI model:', model.name);
		console.log('🤖 Messages:', messages);

		try {
			const response = await fetch('/api/ai/local/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					messages: messages,
					model: (model.api_type || model.id).replace(/^local-/, ''),
					userId: userId,
					temperature: 0.7,
					max_tokens: 4096,
					stream: false
				})
			});

			console.log('🤖 Local AI response status:', response.status);
			console.log('🤖 Local AI response ok:', response.ok);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Local AI API error:', response.status, errorText);

				// Provide user-friendly error messages for local AI failures
				if (response.status === 404) {
					throw new Error(
						'Local AI server not found. Please ensure Ollama is running on localhost:11434'
					);
				} else if (response.status === 500) {
					throw new Error(
						'Local AI server error. The model might not be available or the server is overloaded'
					);
				} else if (response.status >= 400 && response.status < 500) {
					throw new Error(`Local AI request error: ${errorText}`);
				} else {
					throw new Error(`Local AI server error: ${errorText}`);
				}
			}

			const responseData = await response.json();
			console.log('🤖 Local AI response data:', responseData);

			// Enhanced debugging - log the exact structure
			console.log('🔍 Response structure analysis:');
			console.log('🔍 responseData.success:', responseData.success);
			console.log('🔍 responseData.data exists:', !!responseData.data);
			if (responseData.data) {
				console.log('🔍 responseData.data keys:', Object.keys(responseData.data));
				console.log('🔍 responseData.data.response type:', typeof responseData.data.response);
				console.log('🔍 responseData.data.response value:', responseData.data.response);
			}

			// Handle local AI response structure with better error checking
			let finalResponse: string = '';

			if (responseData.success && responseData.data) {
				const outerData = responseData.data;

				// Check for double-wrapped structure (apiTryCatch wrapper)
				if (outerData.success && outerData.data) {
					const innerData = outerData.data;

					if (
						innerData.response &&
						typeof innerData.response === 'string' &&
						innerData.response.trim()
					) {
						finalResponse = innerData.response.trim();
						console.log('✅ Found response in double-wrapped structure: data.data.response');
					} else if (
						innerData.content &&
						typeof innerData.content === 'string' &&
						innerData.content.trim()
					) {
						finalResponse = innerData.content.trim();
						console.log('✅ Found response in double-wrapped structure: data.data.content');
					}
				}
				// Check for single-wrapped structure
				else if (
					outerData.response &&
					typeof outerData.response === 'string' &&
					outerData.response.trim()
				) {
					finalResponse = outerData.response.trim();
					console.log('✅ Found response in single-wrapped structure: data.response');
				} else if (
					outerData.content &&
					typeof outerData.content === 'string' &&
					outerData.content.trim()
				) {
					finalResponse = outerData.content.trim();
					console.log('✅ Found response in single-wrapped structure: data.content');
				}
			}

			// Fallback: check top-level fields
			if (!finalResponse) {
				if (
					responseData.response &&
					typeof responseData.response === 'string' &&
					responseData.response.trim()
				) {
					finalResponse = responseData.response.trim();
					console.log('✅ Found response in top-level response field');
				} else if (
					responseData.content &&
					typeof responseData.content === 'string' &&
					responseData.content.trim()
				) {
					finalResponse = responseData.content.trim();
					console.log('✅ Found response in top-level content field');
				}
			}

			if (!finalResponse) {
				console.error('❌ Could not extract response from local AI');
				console.error('❌ Complete response structure:', JSON.stringify(responseData, null, 2));
				console.error('❌ Available top-level keys:', Object.keys(responseData || {}));
				if (responseData.data) {
					console.error('❌ Available data keys:', Object.keys(responseData.data || {}));
				}
				throw new Error(
					'Local AI returned empty response. Check the logs for response structure details.'
				);
			}

			console.log('🎯 Local AI final response length:', finalResponse.length);
			console.log(
				'🎯 Local AI final response preview:',
				finalResponse.substring(0, 100) + (finalResponse.length > 100 ? '...' : '')
			);
			return finalResponse;
		} catch (error) {
			console.error('❌ Error calling local AI:', error);

			// Re-throw with more context for connection errors
			if (error instanceof TypeError && error.message.includes('fetch')) {
				throw new Error(
					'Cannot connect to local AI server. Please ensure Ollama is running on localhost:11434'
				);
			}

			throw error; // Re-throw the original error if it's already user-friendly
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
