import { writable } from 'svelte/store';
import type { PromptType } from '$lib/types';

export const promptStore = writable<PromptType>('TUTOR');