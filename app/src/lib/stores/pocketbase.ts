import { page } from '$app/stores';
import { derived } from 'svelte/store';
import PocketBase from 'pocketbase';
import { get } from 'svelte/store';

// Export the URL as a separate store for template usage
export const pocketbaseUrl = derived(
    page,
    ($page) => $page.data?.pocketbaseUrl || 'http://localhost:8090'
);

// Export the PocketBase instance
export const pocketbase = derived(
    page,
    ($page) => new PocketBase($page.data?.pocketbaseUrl || 'http://localhost:8090')
);

// Helper function for TypeScript files to get PocketBase instance
export function getPocketBaseFromStore() {
    return get(pocketbase);
}

// Helper function for TypeScript files to get just the URL
export function getPocketbaseUrlFromStore() {
    return get(pocketbaseUrl);
}