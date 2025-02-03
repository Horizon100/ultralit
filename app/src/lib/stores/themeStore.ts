import { writable } from 'svelte/store';
import { pb } from '$lib/pocketbase';
import { currentUser } from '$lib/pocketbase';
import { browser } from '$app/environment';

function createThemeStore() {
	const { subscribe, set, update } = writable('default');

	async function initialize() {
		if (browser) {
			// First try to get theme from localStorage
			const savedTheme = localStorage.getItem('theme');

			// If user is logged in, try to get their preference
			const user = pb.authStore.model;
			if (user) {
				try {
					const userData = await pb.collection('users').getOne(user.id);
					if (userData.theme_preference) {
						set(userData.theme_preference);
						localStorage.setItem('theme', userData.theme_preference);
						document.documentElement.className = userData.theme_preference;
						return;
					}
				} catch (error) {
					console.error('Error loading theme preference:', error);
				}
			}

			// If no user preference, use localStorage or default
			if (savedTheme) {
				set(savedTheme);
				document.documentElement.className = savedTheme;
			} else {
				set('default');
				document.documentElement.className = 'default';
			}
		}
	}

	async function setTheme(theme: string) {
		if (browser) {
			set(theme);
			localStorage.setItem('theme', theme);
			document.documentElement.className = theme;

			// If user is logged in, save preference
			const user = pb.authStore.model;
			if (user) {
				try {
					await pb.collection('users').update(user.id, {
						theme_preference: theme
					});
				} catch (error) {
					console.error('Error saving theme preference:', error);
				}
			}
		}
	}

	return {
		subscribe,
		set: setTheme,
		initialize
	};
}

export const currentTheme = createThemeStore();

// Initialize theme when user state changes
if (browser) {
	currentUser.subscribe(() => {
		currentTheme.initialize();
	});
}
