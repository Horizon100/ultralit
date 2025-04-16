// lib/stores/apiKeyStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';

export interface ApiKeys {
    openai?: string;
    anthropic?: string;
    google?: string;
    grok?: string;
    [key: string]: string | undefined;
}

function createApiKeyStore() {
    const { subscribe, set, update } = writable<Record<string, string>>({});
    let initialized = false;
    let loading = false;

    async function loadKeys() {
        if (!browser || initialized || loading) return;
        loading = true;

        try {
            const isAuthenticated = await ensureAuthenticated();
            if (!isAuthenticated) {
                set({});
                return;
            }

            const response = await fetch('/api/keys', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const keys = await response.json();
                set(keys);
                initialized = true;
            }
        } catch (error) {
            console.error('Error loading API keys:', error);
        } finally {
            loading = false;
        }
    }

    // Initialize when store is created
    loadKeys();

    // Only subscribe to user changes if not initialized
    if (!initialized) {
        currentUser.subscribe((user) => {
            if (user) loadKeys();
        });
    }

    return {
        subscribe,
        loadKeys,
        setKey: async (service: string, key: string) => {
            isLoading = true;
            try {
                const response = await fetch('/api/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ service, key })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                update(keys => ({ ...keys, [service]: key }));
            } catch (error) {
                console.error('Error saving API key:', error);
                throw error;
            } finally {
                isLoading = false;
            }
        },
        deleteKey: async (service: string) => {
            isLoading = true;
            try {
                const response = await fetch(`/api/keys/${service}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                update(keys => {
                    const newKeys = { ...keys };
                    delete newKeys[service];
                    return newKeys;
                });
            } catch (error) {
                console.error('Error deleting API key:', error);
                throw error;
            } finally {
                isLoading = false;
            }
        }
    };
}

export const apiKey = createApiKeyStore();