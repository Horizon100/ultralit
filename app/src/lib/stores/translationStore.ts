import { derived } from 'svelte/store';
import { currentLanguage } from './languageStore';
import en from '../translations/en';
import ru from '../translations/ru';

type Translations = {
	en: typeof en;
	ru: typeof ru;
};

export const translations: Translations = {
	en: en as typeof en,
	ru: ru as typeof ru
};

export const t = derived(currentLanguage, ($currentLanguage) => {
	return (key: string): unknown => {
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
			return key;
		}

		return current;
	};
});
