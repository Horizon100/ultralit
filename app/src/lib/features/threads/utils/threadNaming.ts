import { ensureAuthenticated, currentUser } from '$lib/pocketbase';
import { threadsStore } from '$lib/stores/threadsStore';
import type { AIModel, RoleType, Messages } from '$lib/types/types';
import { defaultModel } from '$lib/features/ai/utils/models';
import { get } from 'svelte/store';
import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';

export async function generateThreadName(
	userMessage: string,
	aiResponse: string,
	model: AIModel,
	userId: string
): Promise<string> {
	const result = await clientTryCatch(
		(async () => {
			if (!model || typeof model !== 'object') {
				console.warn('Invalid model passed to generateThreadName, using default');
				model = { ...defaultModel };
			}

			console.log('Generating thread name for:', {
				userMessage,
				aiResponse,
				modelId: model?.id
			});

			const messages = [
				{
					role: 'system' as RoleType,
					content: `Create a concise, descriptive title (max 50 chars) for a conversation starting with:
                User: ${userMessage}
                Assistant: ${aiResponse}
                Return only the title, no quotes or explanation.`,
					model: model.id || model.api_type
				}
			];

			// Ensure model has all required fields
			const modelToUse: AIModel = {
				...model,
				provider: model.provider || defaultModel.provider,
				api_type: model.api_type || defaultModel.api_type,
				base_url: model.base_url || defaultModel.base_url,
				api_version: model.api_version || defaultModel.api_version,
				api_key: model.api_key || defaultModel.api_key
			};

			console.log('Sending prompt for thread name generation:', messages);

			// Direct API call to bypass fetchAIResponse and prompts
			const fetchResult = await fetchTryCatch('/api/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages,
					model: modelToUse,
					userId
				})
			});

			if (isFailure(fetchResult)) {
				throw new Error(`Failed to generate thread name: ${fetchResult.error}`);
			}

			const data: any = fetchResult.data;

			// FIX: Handle the wrapped response format like in your main AI client
			let responseText: string;
			if (data && typeof data === 'object' && data.success && data.data && data.data.response) {
				responseText = data.data.response;
			} else if (data && typeof data === 'object' && data.response) {
				responseText = data.response;
			} else {
				console.error('Unexpected response format for thread naming:', data);
				throw new Error('Could not extract response from thread naming API');
			}

			console.log('Received thread name suggestion:', responseText);

			const cleanName = responseText
				.replace(/^["']|["']$/g, '')
				.trim()
				.slice(0, 50);

			console.log('Cleaned thread name:', cleanName);
			return cleanName || 'New Conversation';
		})(),
		`Generating thread name for user message: ${userMessage.slice(0, 50)}...`
	);

	if (isFailure(result)) {
		console.error('Error generating thread name:', result.error);
		return 'New Conversation';
	}

	return result.data;
}

export async function shouldUpdateThreadName(messages: Messages[]): Promise<boolean> {
	ensureAuthenticated();
	console.log('Checking if thread name should be updated. Messages count:', messages?.length);

	if (!messages?.length) {
		console.log('No messages found, skipping thread name update');
		return false;
	}

	const robotMessages = messages.filter((m) => m.type === 'robot');
	console.log('Found robot messages:', robotMessages.length);
	return robotMessages.length === 1;
}

export async function updateThreadNameIfNeeded(
	threadId: string,
	messages: Messages[],
	model: AIModel,
	userId: string
): Promise<void> {
	threadsStore.setNamingThreadId(threadId);

	const result = await clientTryCatch(
		(async () => {
			if (!threadId || !messages?.length || !model || !userId) {
				console.log('Missing required data for thread naming, skipping');
				return;
			}

			console.log('Starting thread name update check for thread:', threadId);

			// Save current thread state
			const currentThreads = get(threadsStore).threads;
			const existingThread = currentThreads.find((t) => t.id === threadId);

			if (!existingThread) {
				console.warn('Thread not found in store, skipping naming');
				return;
			}

			// Check if thread was manually named recently
			const manuallyNamed =
				typeof window !== 'undefined' &&
				window.localStorage.getItem(`thread_${threadId}_manual_name`) === 'true';

			const timestamp =
				typeof window !== 'undefined' &&
				window.localStorage.getItem(`thread_${threadId}_name_timestamp`);

			const isRecent = timestamp && Date.now() - parseInt(timestamp) < 10000; // 10 seconds

			if (manuallyNamed && isRecent) {
				console.log('Skipping auto-naming because thread was manually named recently');
				return;
			}

			const lastUserMessage = messages.find((m) => m.type === 'human')?.text || '';
			const lastAIMessage = messages.find((m) => m.type === 'robot')?.text || '';

			if (!lastUserMessage || !lastAIMessage) {
				console.log('Missing user or AI message for naming, skipping');
				return;
			}

			console.log('Found messages for naming:', {
				userMessage: lastUserMessage,
				aiMessage: lastAIMessage
			});

			// Generate thread name
			const newName = await generateThreadName(lastUserMessage, lastAIMessage, model, userId);
			console.log('Generated new thread name:', newName);

			if (!newName || newName === 'New Conversation') {
				console.log('Skipping update with generic name');
				return;
			}

			console.log('Updating thread with new name...');

			// First update the local store IMMEDIATELY to prevent UI disappearance
			threadsStore.update((state) => ({
				...state,
				threads: state.threads.map((thread) =>
					thread.id === threadId ? { ...thread, name: newName } : thread
				)
			}));

			const updateResult = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchTryCatch<{ success: boolean }>(
						`/api/keys/threads/${threadId}`,
						{
							method: 'PATCH',
							credentials: 'include',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${get(currentUser)?.token || ''}`
							},
							body: JSON.stringify({ name: newName })
						}
					);

					if (isFailure(fetchResult)) {
						throw new Error(`Failed to update thread name: ${fetchResult.error}`);
					}

					console.log('Thread updated successfully');

					if (typeof window !== 'undefined') {
						window.localStorage.setItem(`thread_${threadId}_name_timestamp`, Date.now().toString());
					}

					return true;
				})(),
				`Updating thread ${threadId} name to "${newName}"`
			);

			if (isFailure(updateResult)) {
				console.error('Error updating thread name:', updateResult.error);
			}
		})(),
		`Updating thread name for thread ${threadId}`
	);

	if (isFailure(result)) {
		console.error('Error in updateThreadNameIfNeeded:', result.error);
	}

	// Always clean up
	threadsStore.setNamingThreadId(null);
	console.log('Cleared naming state');
}
