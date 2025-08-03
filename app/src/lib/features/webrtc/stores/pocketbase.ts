// lib/stores/pocketbase.ts
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import PocketBase from 'pocketbase';

const initialUrl = PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
console.log('Initializing PocketBase with URL:', initialUrl);

// Create a writable store for the pocketbase URL that can be set safely
export const pocketbaseUrlStore = writable(initialUrl);

// Export the URL as a derived store for template usage
export const pocketbaseUrl = derived(pocketbaseUrlStore, ($url) => $url);

// Export the PocketBase instance
export const pocketbase = derived(pocketbaseUrlStore, ($url) => new PocketBase($url));

// Initialize the URL from page data if available (client-side only)
if (browser) {
	// Try to get the URL from page data when available
	import('$app/stores')
		.then(({ page }) => {
			page.subscribe(($page) => {
				if ($page.data?.pocketbaseUrl) {
					pocketbaseUrlStore.set($page.data.pocketbaseUrl);
				}
			});
		})
		.catch(() => {
			// Fallback if page store is not available
			console.warn('Could not access page store, using default PocketBase URL');
		});
}

// Helper function for TypeScript files to get PocketBase instance
export function getPocketBaseFromStore(): PocketBase {
	if (!browser) {
		// Server-side: use the same env var as your layout server
		const url = process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
		return new PocketBase(url);
	}

	// Client-side: get from store
	let pb: PocketBase;
	const unsubscribe = pocketbase.subscribe(($pb) => {
		pb = $pb;
	});
	unsubscribe();
	return pb!;
}

// Helper function for TypeScript files to get just the URL
export function getPocketbaseUrlFromStore(): string {
	if (!browser) {
		// Server-side: use the same env var as your layout server
		return process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';
	}

	// Client-side: get from store
	let url: string;
	const unsubscribe = pocketbaseUrl.subscribe(($url) => {
		url = $url;
	});
	unsubscribe();
	return url!;
}

// Function to safely set the PocketBase URL (client-side only)
export function setPocketbaseUrl(url: string) {
	if (browser) {
		pocketbaseUrlStore.set(url);
	}
}
