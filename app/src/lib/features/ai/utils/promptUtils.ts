// src/lib/utils/promptUtils.ts
import type { AIMessage, PromptInput, AIModel } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { get } from 'svelte/store';
import { fetchTryCatch, clientTryCatch } from '$lib/utils/errorUtils';

export async function fetchUserPrompts(userId: string): Promise<PromptInput[]> {
	const result = await fetchTryCatch<PromptInput[]>(
		`/api/prompts?userId=${userId}`,
		{
			method: 'GET'
		}
	);

	if (!result.success) {
		console.error('Error fetching user prompts:', result.error);
		return [];
	}

	return result.data;
}

export async function fetchSystemPrompt(promptId: string): Promise<string | null> {
	const result = await fetchTryCatch<{ data?: { prompt?: string } }>(
		`/api/prompts/${promptId}`,
		{
			method: 'GET'
		}
	);

	if (!result.success) {
		console.error('Error fetching system prompt:', result.error);
		return null;
	}

	return result.data.data?.prompt || null;
}

export async function prepareMessagesWithCustomPrompts(
	originalMessages: AIMessage[],
	aiModel: AIModel
): Promise<AIMessage[]> {
	const user = get(currentUser);
	if (!user) return originalMessages;

	const messages = [...originalMessages];
	const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system');

	const allPrompts: string[] = [];

	// Handle system prompt (built-in or custom)
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
				'Failed to fetch custom system prompt'
			);

			if (systemPromptResult.success && systemPromptResult.data) {
				allPrompts.push(systemPromptResult.data);
			}
		}
	}

	if (user.prompt_preference) {
		let promptIds: string[] = [];

		if (Array.isArray(user.prompt_preference)) {
			promptIds = user.prompt_preference;
		} else if (typeof user.prompt_preference === 'string') {
			promptIds = [user.prompt_preference];
		}

		const promptResults = await clientTryCatch(
			Promise.all(
				promptIds.map(async (promptId) => {
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
			content: `${combinedPromptContent}\n\n${messages[systemMessageIndex].content}`,
			provider: aiModel.provider
		};
	} else {
		messages.unshift({
			role: 'system',
			content: combinedPromptContent,
			model: messages[0]?.model || 'default',
			provider: aiModel.provider
		});
	}

	return messages;
}