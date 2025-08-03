// src/lib/stores/languageStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const languages = [
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'ru', name: 'Русский', flag: '🇷🇺' },
	{ code: 'fi', name: 'Suomi', flag: '🇫🇮' }
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

// Initialize with default language
const storedLanguage = browser ? (localStorage.getItem('language') as LanguageCode | null) : null;
export const currentLanguage = writable<LanguageCode>(storedLanguage || 'en');

// Apply language to DOM and persist
function applyLanguage(language: LanguageCode) {
	if (!browser) return;

	document.documentElement.lang = language;
	localStorage.setItem('language', language);
	currentLanguage.set(language);
}

// Initialize language
export function initializeLanguage() {
	if (!browser) return;

	// 1. Check localStorage first
	const savedLanguage = localStorage.getItem('language') as LanguageCode | null;
	if (savedLanguage && languages.some((l) => l.code === savedLanguage)) {
		applyLanguage(savedLanguage);
		return;
	}

	// 2. Fallback to browser language or English
	const browserLang = browser ? navigator.language.slice(0, 2) : 'en';
	const validLang: LanguageCode = languages.some((l) => l.code === browserLang)
		? (browserLang as LanguageCode)
		: 'en';
	applyLanguage(validLang);
}

// Set new language
export function setLanguage(languageCode: LanguageCode) {
	if (!languages.some((l) => l.code === languageCode)) return;
	applyLanguage(languageCode);
}

// Initialize on store load
if (browser) {
	initializeLanguage();
}