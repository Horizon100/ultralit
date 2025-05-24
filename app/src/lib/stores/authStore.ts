import { writable } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';

export const showAuth = writable(false);

export function toggleAuth(forceOrEvent?: boolean | Event) {
	if (forceOrEvent === undefined) {
		// No parameters, just toggle
		showAuth.update((value) => !value);
	} else if (typeof forceOrEvent === 'boolean') {
		// Boolean parameter, set directly
		showAuth.set(forceOrEvent);
	} else {
		// It's an event, ignore it and toggle
		showAuth.update((value) => !value);
	}
}
// Initialize the auth state based on user status
export function initAuthState() {
	// Subscribe to user changes to manage auth state
	const unsubscribe = currentUser.subscribe((user) => {
		// If user logs in, close the auth overlay
		if (user) {
			showAuth.set(false);
		}
		// Don't automatically show auth when logged out
	});

	return unsubscribe;
}
