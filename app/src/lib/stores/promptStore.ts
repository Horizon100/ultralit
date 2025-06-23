import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import type { PromptType, AIMessage, AIModel } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { fetchSystemPrompt } from '$lib/features/ai/utils/prompts';
import { tryCatchSync, clientTryCatch, fetchTryCatch } from '$lib/utils/errorUtils';

let manualUpdate = false;

export const promptStore = writable<{
	selectedPromptId: string | null;
	promptContent: string | null;
	promptType: PromptType | null;
}>({
	selectedPromptId: null,
	promptContent: null,
	promptType: null
});

export const syspromptStore = writable<{
	selectedPromptId: string | null;
	promptContent: string | null;
	promptType: PromptType | null;
}>({
	selectedPromptId: null,
	promptContent: null,
	promptType: null
});

export function setSystemPrompt(promptType: PromptType) {
	const result = tryCatchSync(() => {
		manualUpdate = true;
		setTimeout(() => {
			manualUpdate = false;
		}, 1000);

		syspromptStore.update((state) => ({
			...state,
			promptType,
			selectedPromptId: null
		}));
	});

	if (!result.success) {
		console.error('Error setting system prompt:', result.error);
	}
}

export async function initPromptStores(userData: any) {
	if (!userData || manualUpdate) return;

	const result = tryCatchSync(() => {
		if (userData.sysprompt_preference) {
			if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(userData.sysprompt_preference)) {
				syspromptStore.update((state) => ({
					...state,
					promptType: userData.sysprompt_preference as PromptType,
					selectedPromptId: null
				}));
			}
		}
	});

	if (!result.success) {
		console.error('Error initializing prompt stores:', result.error);
	}
}

export async function prepareMessagesWithCustomPrompts(
	originalMessages: AIMessage[],
	aiModel: AIModel
): Promise<AIMessage[]> {
	const user = get(currentUser);
	if (!user) return originalMessages;

	const result = await clientTryCatch(
		(async () => {
			const messages = [...originalMessages];
			const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system');

			const allPrompts: string[] = [];

			// Get system prompt
			if (user.sysprompt_preference) {
				if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
					const SYSTEM_PROMPTS = {
						NORMAL: 'Respond naturally and conversationally with balanced detail.',
						CONCISE: 'Provide brief responses focused on key information only.',
						CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
						INTERVIEW: 'Ask probing questions to gather more information.'
					};
					const systemPrompt = SYSTEM_PROMPTS[user.sysprompt_preference as keyof typeof SYSTEM_PROMPTS];
					if (systemPrompt) allPrompts.push(systemPrompt);
				} else {
					const systemPromptResult = await clientTryCatch(
						fetchSystemPrompt(user.sysprompt_preference),
						'Failed to fetch system prompt'
					);
					if (systemPromptResult.success && systemPromptResult.data) {
						allPrompts.push(systemPromptResult.data);
					}
				}
			}

			// Get user prompts - fetch each individually
			if (user.prompt_preference && Array.isArray(user.prompt_preference)) {
				const promptResults = await clientTryCatch(
					Promise.all(
						user.prompt_preference.map(async (promptId) => {
							const result = await fetchTryCatch<{ data?: { prompt?: string } }>(
								`/api/prompts/${promptId}`,
								{
									method: 'GET'
								}
							);

							if (result.success && result.data.data?.prompt) {
								return result.data.data.prompt;
							}
							return null;
						})
					),
					'Failed to fetch user prompts'
				);

				if (promptResults.success) {
					const validPrompts = promptResults.data.filter((prompt): prompt is string => prompt !== null);
					allPrompts.push(...validPrompts);
				} else {
					console.error('Error fetching user prompts:', promptResults.error);
				}
			}

			if (allPrompts.length === 0) return messages;

			const combinedPromptContent = allPrompts.join('\n\n');

			if (systemMessageIndex >= 0) {
				messages[systemMessageIndex] = {
					...messages[systemMessageIndex],
					content: `${combinedPromptContent}\n\n${messages[systemMessageIndex].content}`
				};
			} else {
				messages.unshift({
					role: 'system',
					content: combinedPromptContent,
					provider: aiModel.provider,
					model: messages[0]?.model || 'default'
				});
			}

			return messages;
		})(),
		'Failed to prepare messages with custom prompts'
	);

	if (!result.success) {
		console.error('Error in prepareMessagesWithCustomPrompts:', result.error);
		return originalMessages;
	}

	return result.data;
}