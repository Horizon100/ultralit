// utils/formatters.ts - Updated version
import type { Scenario, Task, RoleType, PromptType, NetworkData, AIAgent } from '$lib/types/types';
import { t } from '$lib/stores/translationStore';
import { get } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { fetchSystemPrompt, fetchUserPrompts } from '$lib/features/ai/utils/promptUtils';

type MessageContent = string | Scenario[] | Task[] | AIAgent | NetworkData;

export function formatDate(date: string): string {
	const translate = get(t);

	if (date === translate('threads.today') || date === translate('threads.yesterday')) {
		return date;
	}

	return new Date(date).toLocaleDateString('en-US', {
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

// Updated formatContent to work with custom prompts
export async function formatContent(
	content: MessageContent,
	type: PromptType,
	role: RoleType
): Promise<string> {
	const baseContent = typeof content === 'string' ? content : JSON.stringify(content);

	if (role !== 'assistant') {
		return baseContent;
	}

	// Get user's custom prompts
	const user = get(currentUser);
	if (!user) return baseContent;

	let customPrompts: string[] = [];

	// Get user's preferred prompts
	if (user.prompt_preference && user.prompt_preference.length > 0) {
		const userPrompts = await fetchUserPrompts(user.id);
		const preferredPrompts = userPrompts.filter((p) => user.prompt_preference.includes(p.id));
		customPrompts = preferredPrompts.map((p) => p.prompt);
	}

	// Get system prompt
	let systemPrompt: string | null = null;
	if (user.sysprompt_preference) {
		systemPrompt = await fetchSystemPrompt(user.sysprompt_preference);
	}

	// Combine all prompts
	const allPrompts = [...(systemPrompt ? [systemPrompt] : []), ...customPrompts].filter(Boolean);

	if (allPrompts.length === 0) return baseContent;

	const promptText = allPrompts.join('\n\n');
	return `[Applied Prompts: ${promptText}]\n${baseContent}`;
}

// Synchronous version for backward compatibility
export function formatContentSync(
	content: MessageContent,
	type: PromptType,
	role: RoleType
): string {
	const baseContent = typeof content === 'string' ? content : JSON.stringify(content);

	// For assistant messages, show that custom prompts are being applied
	if (role === 'assistant' && type) {
		return `[Prompt: ${type}]\n${baseContent}`;
	}

	return baseContent;
}

export function getRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHour = Math.floor(diffMin / 60);
	const diffDays = Math.floor(diffHour / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffSec < 60) {
		return 'just now';
	} else if (diffMin < 60) {
		return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
	} else if (diffHour < 24) {
		return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
	} else if (diffDays < 7) {
		return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
	} else if (diffWeeks < 4) {
		return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
	} else if (diffMonths < 12) {
		return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
	} else {
		return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
	}
}
