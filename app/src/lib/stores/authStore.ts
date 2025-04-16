// lib/stores/authStore.ts
import { writable } from 'svelte/store';
import { pb } from '$lib/server/pocketbase';
import { apiKey } from './apiKeyStore';

async function initializeAuth() {
    try {
        const response = await fetch('/api/verify/auth-check', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                pb.authStore.save(pb.authStore.token, data.user);
                await apiKey.loadKeys();
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Auth initialization error:', error);
        return false;
    }
}

export const authInitialized = writable(false);

// Initialize once when store is loaded
initializeAuth().then(success => {
    authInitialized.set(success);
});