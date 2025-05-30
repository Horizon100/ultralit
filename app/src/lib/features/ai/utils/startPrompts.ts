import { t } from '$lib/stores/translationStore';
import { get } from 'svelte/store';

export function getRandomPrompts(count: number = 3): string[] {
    const $t = get(t);
    const prompts = $t('startPrompts') as string[];
    
    if (!Array.isArray(prompts)) {
        console.warn('startPrompts not found in translations, using fallback');
        return [];
    }
    
    const shuffled = [...prompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}