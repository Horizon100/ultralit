import { writable } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';

export const showAuth = writable(false);

// Enhanced toggle with optional force parameter
export function toggleAuth(force?: boolean) {
  if (force !== undefined) {
    showAuth.set(force);
  } else {
    showAuth.update(value => !value);
  }
}

// Initialize the auth state based on user status
export function initAuthState() {
  // Subscribe to user changes to manage auth state
  const unsubscribe = currentUser.subscribe(user => {
    // If user logs in, close the auth overlay
    if (user) {
      showAuth.set(false);
    }
    // Don't automatically show auth when logged out
  });
  
  return unsubscribe;
}