import { writable } from 'svelte/store';
import { pb } from '$lib/pocketbase';
import { get } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';

export const languages = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
    // Add more languages as needed
];

export const currentLanguage = writable(languages[0].code);

export async function setLanguage(languageCode: string) {
    const language = languages.find(lang => lang.code === languageCode);
    if (language) {
        currentLanguage.set(languageCode);
        
        // Save language preference to PocketBase user collection
        const user = get(currentUser);
        if (user) {
            try {
                await pb.collection('users').update(user.id, { language_preference: languageCode });
                console.log('Language preference saved successfully');
            } catch (error) {
                console.error('Failed to save language preference:', error);
            }
        }
    }
}

export async function initializeLanguage() {
    const user = get(currentUser);
    if (user) {
        try {
            const userData = await pb.collection('users').getOne(user.id);
            if (userData.language_preference) {
                currentLanguage.set(userData.language_preference);
            }
        } catch (error) {
            console.error('Failed to fetch user language preference:', error);
        }
    }
}