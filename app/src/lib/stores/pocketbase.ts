import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import PocketBase from 'pocketbase';
import { get } from 'svelte/store';

// Create a writable store for the pocketbase URL that can be set safely
export const pocketbaseUrlStore = writable('http://localhost:8090');

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

export function getPocketBaseFromStore(): PocketBase {
	if (!browser) {
		const url = process.env.POCKETBASE_URL || 'http://localhost:8090';
		return new PocketBase(url);
	}

	const pb = get(pocketbase);
	if (!pb) {
		throw new Error('PocketBase instance not available in store');
	}
	return pb;
}

export function getPocketbaseUrlFromStore(): string {
	if (!browser) {
		return process.env.POCKETBASE_URL || 'http://localhost:8090';
	}

	const url = get(pocketbaseUrl);
	if (!url) {
		throw new Error('PocketBase URL not available in store');
	}
	return url;
}

export function setPocketbaseUrl(url: string) {
	if (browser) {
		pocketbaseUrlStore.set(url);
	}
}
