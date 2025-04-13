import { writable } from 'svelte/store';
import type { PromptInput } from '$lib/types/types';
import { fetchUserPrompts } from '$lib/clients/promptInputClient';

function createPromptInputStore() {
	const { subscribe, update, set } = writable<PromptInput[]>([]);
	
	// Initialize by loading prompts
	(async () => {
		try {
			const prompts = await fetchUserPrompts();
			set(prompts);
		} catch (error) {
			console.error('Failed to initialize prompts:', error);
		}
	})();
	
	return {
		subscribe,
		setPrompts: (prompts: PromptInput[]) => set(prompts),
		addPrompt: (prompt: PromptInput) => update(prompts => [...prompts, prompt]),
		removePrompt: (id: string) => update(prompts => prompts.filter(p => p.id !== id)),
		updatePrompt: (id: string, updatedPrompt: Partial<PromptInput>) => update(prompts => 
			prompts.map(p => p.id === id ? { ...p, ...updatedPrompt } : p)
		),
		loadPrompts: async () => {
			try {
				const prompts = await fetchUserPrompts();
				set(prompts);
				return prompts;
			} catch (error) {
				console.error('Failed to load prompts:', error);
				return [];
			}
		}
	};
}

export const promptInputStore = createPromptInputStore();