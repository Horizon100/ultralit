// src/lib/stores/languageStore.ts
import { writable, get } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { browser } from '$app/environment';

export const languages = [
	{ code: 'en', name: 'English' },
	{ code: 'ru', name: 'Русский' }
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
export async function initializeLanguage() {
	if (!browser) return;

	// 1. Check localStorage first
	const savedLanguage = localStorage.getItem('language') as LanguageCode | null;
	if (savedLanguage && languages.some((l) => l.code === savedLanguage)) {
		applyLanguage(savedLanguage);
		return;
	}

	// 2. Check user preference if logged in
	const user = get(currentUser);
	if (user?.id) {
		try {
			const response = await fetch(`/api/users/${user.id}/language`);
			if (response.ok) {
				const { language } = await response.json();
				if (language && languages.some((l) => l.code === language)) {
					applyLanguage(language);
					return;
				}
			}
		} catch (err) {
			console.error('Failed to load user language:', err);
		}
	}

	// 3. Fallback to browser language or English
	const browserLang = browser ? navigator.language.slice(0, 2) : 'en';
	const validLang: LanguageCode = languages.some((l) => l.code === browserLang)
		? (browserLang as LanguageCode)
		: 'en';
	applyLanguage(validLang);
}

// Set new language
export async function setLanguage(languageCode: LanguageCode) {
	if (!languages.some((l) => l.code === languageCode)) return;

	applyLanguage(languageCode);

	// Update server if user is logged in
	const user = get(currentUser);
	if (user?.id) {
		try {
			await fetch(`/api/users/${user.id}/language`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ language: languageCode })
			});
		} catch (err) {
			console.error('Failed to save language:', err);
		}
	}
}

// Initialize on store load
if (browser) {
	initializeLanguage();

	// Watch for auth changes
	currentUser.subscribe(() => {
		initializeLanguage();
	});
}
