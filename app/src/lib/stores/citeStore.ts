// src/lib/stores/citeStore.ts
import { writable, get, derived } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { browser } from '$app/environment';

// Changed to use valid CSS class names (no spaces or special chars)
export const availableCites = ['wiki', 'quora', 'x', 'google', 'reddit'] as const;
export type Cite = (typeof availableCites)[number];

const DEFAULT_CITE: Cite = 'wiki';

interface CiteStoreState {
	cite: Cite;
	isInitializing: boolean;
	isInitialized: boolean;
}

function createCiteStore() {
	const store = writable<CiteStoreState>({
		cite: DEFAULT_CITE,
		isInitializing: false,
		isInitialized: false
	});

	const citeOnly = derived(store, ($state) => $state.cite);

	const applyCites = (cite: Cite) => {
		if (!browser) return;

		// Remove all possible cite classes first
		availableCites.forEach((c) => document.documentElement.classList.remove(`cite-${c}`));

		// Add the new cite class
		document.documentElement.classList.add(`cite-${cite}`);

		store.update((state) => ({ ...state, cite }));

		localStorage.setItem('cite', cite);
	};

	const initialize = async () => {
		if (!browser) return;

		const state = get(store);
		if (state.isInitializing || state.isInitialized) return;

		store.update((state) => ({ ...state, isInitializing: true }));

		try {
			// 1. Check localStorage first for fast initial render
			const savedCite = localStorage.getItem('cite') as Cite | null;
			if (savedCite && availableCites.includes(savedCite)) {
				applyCites(savedCite);
				store.update((state) => ({
					...state,
					isInitializing: false,
					isInitialized: true
				}));
				return;
			}

			// 2. Check user preference if logged in
			const user = get(currentUser);
			if (user?.id) {
				try {
					const response = await fetch(`/api/users/${user.id}/cite`);
					if (response.ok) {
						const data = await response.json();
						const cite = data.cite;

						if (cite && availableCites.includes(cite)) {
							applyCites(cite);
						}
					}
				} catch (err) {
					console.error('Failed to load user cite:', err);
					// Continue to fallback
				}
			}

			// 3. Fallback to default cite
			applyCites(DEFAULT_CITE);
		} finally {
			store.update((state) => ({
				...state,
				isInitializing: false,
				isInitialized: true
			}));
		}
	};

	const setCite = async (cite: Cite) => {
		if (!browser || !availableCites.includes(cite)) return;

		// Apply cite immediately for responsive UI
		applyCites(cite);

		// Update server if user is logged in - in the background
		const user = get(currentUser);
		if (user?.id) {
			try {
				const response = await fetch(`/api/users/${user.id}/cite`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cite })
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error('Failed to save cite:', errorData.error || response.statusText);
					/*
					 * Optionally revert the local change if server update fails
					 * const currentState = get(store);
					 * applyCites(currentState.cite);
					 */
				}
			} catch (err) {
				console.error('Network error saving cite:', err);
			}
		}
	};
	return {
		subscribe: citeOnly.subscribe,
		set: setCite,
		initialize,
		applyCites,
		_store: {
			subscribe: store.subscribe
		}
	};
}

export const currentCite = createCiteStore();
export const citeState = currentCite._store;
export const effectiveCite = currentCite;

if (browser) {
	let previousUserId: string | null = null;

	currentUser.subscribe((user) => {
		if (user?.id !== previousUserId) {
			previousUserId = user?.id || null;
			currentCite.initialize();
		}
	});

	currentCite.initialize();
}
