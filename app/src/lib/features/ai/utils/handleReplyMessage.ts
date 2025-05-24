// src/lib/utils/handleReplyMessage.ts
import type { InternalChatMessage } from '$lib/types/types';

/**
 * Prepares a message payload with proper context for replies
 * @param message - The text content of the reply
 * @param parentMessageId - ID of the message being replied to
 * @param allMessages - All chat messages to find context
 * @param aiModel - The selected AI model
 * @param promptType - Current prompt type if any
 * @returns Object with prepared messages to send and context
 */
export function prepareReplyContext(
	message: string,
	parentMessageId: string,
	allMessages: InternalChatMessage[],
	aiModel: any,
	promptType: string | null = null
) {
	// Find the parent message
	const parentMessage = allMessages.find((msg) => msg.id === parentMessageId);

	if (!parentMessage) {
		console.error('Parent message not found:', parentMessageId);
		return {
			messagesToSend: [
				{
					role: 'user',
					content: message,
					model: aiModel?.api_type
				}
			],
			contextMessage: null
		};
	}

	// Create context by including the parent message
	const contextMessage = `Replying to: "${parentMessage.content}"\n\n${message}`;

	// Create messages payload for the AI
	const messagesToSend = [
		{
			role: 'system',
			content: `The user is replying to a previous message. Below is the message they're replying to, followed by their reply. Please respond considering the context of the previous message.`,
			model: aiModel?.api_type
		},
		{
			role: 'assistant',
			content: parentMessage.content,
			model: aiModel?.api_type
		},
		{
			role: 'user',
			content: promptType ? `[Using ${promptType} prompt]\n${message}` : message,
			model: aiModel?.api_type
		}
	];

	return {
		messagesToSend,
		contextMessage
	};
}
