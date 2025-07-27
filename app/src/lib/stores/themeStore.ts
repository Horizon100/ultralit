// src/lib/stores/themeStore.ts
import { writable, get, derived } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { browser } from '$app/environment';

export const availableThemes = [
	'light',
	'dark',
	'default',
	'sunset',
	'bone',
	'focus',
	'turbo',
	'bold',
	'ivoryx'
] as const;
export type Theme = (typeof availableThemes)[number];

const DEFAULT_THEME: Theme = 'default';
const NON_AUTH_DEFAULT_THEME: Theme = 'default';
interface ThemeStoreState {
	theme: Theme;
	isInitializing: boolean;
	isInitialized: boolean;
}

function createThemeStore() {
	const store = writable<ThemeStoreState>({
		theme: DEFAULT_THEME,
		isInitializing: false,
		isInitialized: false
	});

	const themeOnly = derived(store, ($state) => $state.theme);

const applyTheme = (theme: Theme) => {
	if (!browser) return;

	// Remove all available theme classes first
	document.documentElement.classList.remove(...availableThemes);
	// Add the current theme class
	document.documentElement.classList.add(theme);

	store.update((state) => ({ ...state, theme }));
	localStorage.setItem('theme', theme);
};

const initialize = async () => {
   if (!browser) return;

   const state = get(store);
   if (state.isInitializing || state.isInitialized) return;

   store.update((state) => ({ ...state, isInitializing: true }));

   const user = get(currentUser);
   
   // For non-authenticated users
   if (!user?.id) {
   	const savedTheme = localStorage.getItem('theme') as Theme | null;
   	const themeToUse = (savedTheme && availableThemes.includes(savedTheme)) 
   		? savedTheme 
   		: 'default'; // Set your preferred default theme for non-auth users here
   			console.log('🎨 Non-auth user theme:', { savedTheme, themeToUse });

   	applyTheme(themeToUse);
   	store.update((state) => ({
   		...state,
   		isInitializing: false,
   		isInitialized: true
   	}));
   	return;
   }

   // For authenticated users - check localStorage first
   const savedTheme = localStorage.getItem('theme') as Theme | null;
   if (savedTheme && availableThemes.includes(savedTheme)) {
   	applyTheme(savedTheme);
   	store.update((state) => ({
   		...state,
   		isInitializing: false,
   		isInitialized: true
   	}));
   	return;
   }

   // Try to fetch from server for authenticated users
   try {
   	const controller = new AbortController();
   	const timeoutId = setTimeout(() => controller.abort(), 3000);

   	const response = await fetch(`/api/users/${user.id}/themes`, {
   		signal: controller.signal
   	});

   	clearTimeout(timeoutId);

   	if (response.ok) {
   		const data = await response.json();
   		const theme = data.theme;

   		if (theme && availableThemes.includes(theme)) {
   			applyTheme(theme);
   			store.update((state) => ({
   				...state,
   				isInitializing: false,
   				isInitialized: true
   			}));
   			return;
   		}
   	}
   } catch (err) {
   	console.error('Failed to load user theme:', err);
   	// Continue to fallback
   }

   // Fallback to default theme for authenticated users
   applyTheme(DEFAULT_THEME);
   store.update((state) => ({
   	...state,
   	isInitializing: false,
   	isInitialized: true
   }));
};

	const setTheme = async (theme: Theme) => {
		if (!browser || !availableThemes.includes(theme)) return;

		applyTheme(theme);

		const user = get(currentUser);
		if (user?.id) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000);

				await fetch(`/api/users/${user.id}/themes`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ theme }),
					signal: controller.signal
				});

				clearTimeout(timeoutId);
			} catch (err) {
				console.error('Failed to save theme to server:', err);
			}
		}
	};

	return {
		subscribe: themeOnly.subscribe,
		set: setTheme,
		initialize,
		applyTheme,
		_store: {
			subscribe: store.subscribe
		}
	};
}

export const currentTheme = createThemeStore();

export const themeState = currentTheme._store;

export const effectiveTheme = currentTheme;

if (browser) {
	let previousUserId: string | null = null;

	currentUser.subscribe((user) => {
		// Only reinitialize if the user ID changed
		if (user?.id !== previousUserId) {
			previousUserId = user?.id || null;
			currentTheme.initialize();
		}
	});

	// Initial load
	currentTheme.initialize();
}
