// lib/auth.ts
import { writable } from 'svelte/store';
import type { User } from '$lib/types/types';

export const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;
export const currentUser = writable<User | null>(null);

// Initialize from localStorage if available
function initialize() {
    if (typeof window !== 'undefined') {
        try {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                currentUser.set(JSON.parse(storedUser));
            }
        } catch (e) {
            console.error('Error loading stored user data:', e);
        }
    }
}

// Subscribe to changes and update localStorage
currentUser.subscribe((user) => {
    if (typeof window !== 'undefined') {
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('currentUser');
        }
    }
});

// Client-side auth check
export async function checkAuth(): Promise<boolean> {
    try {
        const response = await fetch('/api/verify/auth-check', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            currentUser.set(null);
            return false;
        }

        const data = await response.json();
        if (data.success && data.user) {
            currentUser.set(data.user);
            return true;
        }
        
        currentUser.set(null);
        return false;
    } catch (error) {
        console.error('Auth check error:', error);
        currentUser.set(null);
        return false;
    }
}

// Initialize when loaded
initialize();