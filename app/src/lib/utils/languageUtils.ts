import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { currentLanguage, languages, setLanguage } from '$lib/stores/languageStore';

export const showLanguageNotification = writable(false);
export const selectedLanguageName = writable('');

export async function cycleLanguage() {
	const currentLang = get(currentLanguage);
	const currentIndex = languages.findIndex((lang) => lang.code === currentLang);
	const nextIndex = (currentIndex + 1) % languages.length;
	const nextLanguage = languages[nextIndex];

	await setLanguage(nextLanguage.code);
	selectedLanguageName.set(nextLanguage.name);

	showLanguageNotification.set(true);
	setTimeout(() => {
		showLanguageNotification.set(false);
	}, 3000);
}
