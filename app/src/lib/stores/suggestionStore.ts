import { writable } from 'svelte/store';

export const pendingSuggestion = writable<string | null>(null);
