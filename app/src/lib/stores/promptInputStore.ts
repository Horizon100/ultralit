import { writable } from 'svelte/store';
import type { PromptInput } from '$lib/types/types';
import { fetchUserPrompts } from '$lib/clients/promptInputClient';
import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

function createPromptInputStore() {
	const { subscribe, update, set } = writable<PromptInput[]>([]);

	return {
		subscribe,
		setPrompts: (prompts: PromptInput[]) => set(prompts),
		addPrompt: (prompt: PromptInput) => update((prompts) => [...prompts, prompt]),
		removePrompt: (id: string) => update((prompts) => prompts.filter((p) => p.id !== id)),
		updatePrompt: (id: string, updatedPrompt: Partial<PromptInput>) =>
			update((prompts) => prompts.map((p) => (p.id === id ? { ...p, ...updatedPrompt } : p))),
		loadPrompts: async () => {
			const result = await clientTryCatch(
				(async () => {
					const userPrompts = await fetchUserPrompts();
					set(userPrompts);
					return userPrompts;
				})(),
				'Loading user prompts'
			);

			if (isFailure(result)) {
				console.error('Failed to load prompts:', result.error);
				return [];
			}

			return result.data;
		}
	};
}

export const promptInputStore = createPromptInputStore();
