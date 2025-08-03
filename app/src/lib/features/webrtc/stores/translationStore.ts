import { derived } from 'svelte/store';
import { currentLanguage } from './languageStore';
import en from '$lib/translations/en';
import ru from '$lib/translations/ru';
import fi from '$lib/translations/fi';

type Translations = {
	en: typeof en;
	ru: typeof ru;
	fi: typeof fi;
};

export const translations: Translations = {
	en: en as typeof en,
	ru: ru as typeof ru,
	fi: fi as typeof fi
};
export const t = derived(currentLanguage, ($currentLanguage) => {
    return (key: string): any => { // Changed from string to any
        const keys = key.split('.');
        let current: unknown = translations[$currentLanguage];

        for (const k of keys) {
            if (current === undefined || current === null) break;
            if (typeof current === 'object' && !Array.isArray(current) && current !== null) {
                current = (current as Record<string, unknown>)[k];
            } else {
                current = undefined;
                break;
            }
        }

        if (current === undefined || current === null) {
            console.warn(`Translation key "${key}" not found for language "${$currentLanguage}"`);
            return Array.isArray(current) ? [] : key;
        }

        return current; // Can now return arrays or strings
    };
});