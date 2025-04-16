import type { Scenario, Task, RoleType, PromptType, NetworkData, AIAgent } from '$lib/types/types';
import { t } from '$lib/stores/translationStore';
import { get } from 'svelte/store';
import { getPromptText } from '$lib/utils/promptHandlers';

type MessageContent = string | Scenario[] | Task[] | AIAgent | NetworkData;

export function formatDate(date: string): string {
	// Get the current value of the t store
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

export function formatContent(content: MessageContent, type: PromptType, role: RoleType): string {
	const baseContent = typeof content === 'string' ? content : JSON.stringify(content);
	const promptText = type ? getPromptText(type) : '';

	return role === 'assistant' && promptText
		? `[Instructions: ${promptText}]\n${baseContent}`
		: baseContent;
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
