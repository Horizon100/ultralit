// lib/components/common/utils/phrases.ts
import { t } from '$lib/stores/translationStore';
import { get } from 'svelte/store';

export function getRandomThinkingPhrase(): string {
	const translationStore = get(t);
	const phrases = translationStore?.extras?.thinking || [];

	if (phrases.length === 0) {
		return 'Thinking...'; // Fallback phrase
	}

	return phrases[Math.floor(Math.random() * phrases.length)];
}
