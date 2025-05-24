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
  return (key: string): string => {
    const keys = key.split('.');
    let current: any = translations[$currentLanguage]; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    for (const k of keys) {
      if (current === undefined || current === null) break;
      current = current[k];
    }

    if (typeof current !== 'string') {
      console.warn(`Translation key "${key}" not found for language "${$currentLanguage}"`);
      return key;
    }

    return current;
  };
});