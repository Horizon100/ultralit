import type { PromptType } from '$lib/types/types';
import type { AIMessage, AIModel, PromptInput } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { get } from 'svelte/store';
import { clientTryCatch, fetchTryCatch } from '$lib/utils/errorUtils';
import { type IconName } from '$lib/utils/lucideIcons';

export let aiModel: AIModel;

export const SYSTEM_PROMPTS = {
	NORMAL: 'Respond naturally and conversationally with balanced detail.',
	CONCISE: 'Provide brief responses focused on key information only.',
	CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
	INTERVIEW: 'Ask probing questions to gather more information.'
};

export const availablePrompts: Array<{
	value: PromptType;
	label: string;
	icon: IconName;
	description: string;
}> = [
	{
		value: 'NORMAL',
		label: 'Normal',
		icon: 'MessageSquareText',
		description: 'Balanced responses with appropriate detail for most conversations.'
	},
	{
		value: 'CONCISE',
		label: 'Concise',
		icon: 'Minimize',
		description: 'Brief, to-the-point responses that focus only on essential information.'
	},
	{
		value: 'CRITICAL',
		label: 'Critical',
		icon: 'AlertCircle',
		description:
			'Analytical responses that evaluate information critically and suggest improvements.'
	},
	{
		value: 'INTERVIEW',
		label: 'Interview',
		icon: 'HelpCircle',
		description: 'Response style that asks follow-up questions to gather more information.'
	}
];
export const getPrompt = (type: PromptType, context: string): string => {
	switch (type) {
		case 'NORMAL':
			return `${SYSTEM_PROMPTS.NORMAL}\n${context}`;
		case 'CONCISE':
			return `${SYSTEM_PROMPTS.CONCISE}\n${context}`;
		case 'CRITICAL':
			return `${SYSTEM_PROMPTS.CRITICAL}\n${context}`;
		case 'INTERVIEW':
			return `${SYSTEM_PROMPTS.INTERVIEW}\n${context}`;
		default:
			return context;
	}
};
export function getPromptLabelFromContent(promptContent: string | null): string {
	if (!promptContent) return '';

	// Check if it matches any of the system prompts
	for (const [key, value] of Object.entries(SYSTEM_PROMPTS)) {
		if (promptContent.includes(value) || value.includes(promptContent)) {
			return key;
		}
	}

	// If no match found, try to find in availablePrompts by description
	const prompt = availablePrompts.find(
		(p) => promptContent.includes(p.description) || p.description.includes(promptContent)
	);

	return prompt?.value || promptContent || '';
}
export function getPromptInfo(promptType: PromptType | string | null) {
	if (!promptType) return null;

	const prompt = availablePrompts.find((p) => p.value === promptType);
	return prompt || null;
}

export function getPromptLabel(promptType: PromptType | string | null): string {
	const promptInfo = getPromptInfo(promptType);
	return promptInfo?.label || promptType || '';
}

export function getPromptDescription(promptType: PromptType | string | null): string {
	const promptInfo = getPromptInfo(promptType);
	return promptInfo?.description || '';
}

export async function fetchUserPrompts(userId: string): Promise<PromptInput[]> {
	if (!userId) return [];

	const { data, error, success } = await clientTryCatch(
		fetch(`/api/prompts?userId=${userId}`).then((res) => {
			if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.statusText}`);
			return res.json();
		})
	);

	if (success && data) {
		return data;
	} else {
		console.error('Error fetching user prompts:', error);
		return [];
	}
}
export async function fetchSystemPrompt(promptId: string): Promise<string | null> {
	if (!promptId) return null;

	const { data, error, success } = await clientTryCatch(
		fetch(`/api/prompts/${promptId}`).then((res) => {
			if (!res.ok) throw new Error(`Failed to fetch prompt: ${res.statusText}`);
			return res.json();
		})
	);

	if (success && data) {
		return data.data?.prompt || null;
	} else {
		console.error('Error fetching system prompt:', error);
		return null;
	}
}

export async function prepareMessagesWithCustomPrompts(
	originalMessages: AIMessage[]
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

	// Get provider from the first message or use a default
	const provider = messages[0]?.provider || 'deepseek';

	if (systemMessageIndex >= 0) {
		messages[systemMessageIndex] = {
			...messages[systemMessageIndex],
			content: `${combinedPromptContent}\n\n${messages[systemMessageIndex].content}`,
			provider: provider
		};
	} else {
		messages.unshift({
			role: 'system',
			content: combinedPromptContent,
			model: messages[0]?.model || 'default',
			provider: provider
		});
	}

	return messages;
}
