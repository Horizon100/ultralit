// lib/stores/apiKeyStore.ts - UPDATED VERSION
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';

export interface ApiKeys {
    openai?: string;
    anthropic?: string;
    google?: string;
    grok?: string;
    deepseek?: string;
    [key: string]: string | undefined;
}

function createApiKeyStore() {
    const { subscribe, set, update } = writable<ApiKeys>({});
    let initialized = false;
    let loading = false;
    
    // Create a separate loading state store
    const { subscribe: subscribeLoading, set: setLoading } = writable<boolean>(false);

    async function loadKeys() {
        if (!browser || initialized || loading) return;
        loading = true;
        setLoading(true);

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
                console.log('Loaded API keys:', Object.keys(keys));
                
                // Ensure we have a proper ApiKeys object
                if (typeof keys === 'object' && keys !== null) {
                    set(keys);
                } else {
                    console.warn('Invalid keys format received:', keys);
                    set({});
                }
                initialized = true;
            } else {
                console.error('Failed to load API keys:', response.status);
                set({});
            }
        } catch (error) {
            console.error('Error loading API keys:', error);
            set({});
        } finally {
            loading = false;
            setLoading(false);
        }
    }

    // Initialize when store is created
    loadKeys();

    // Only subscribe to user changes if not initialized
    if (!initialized) {
        currentUser.subscribe((user) => {
            if (user) {
                loadKeys();
            } else {
                set({});
                initialized = false;
            }
        });
    }

    return {
        subscribe,
        loadKeys,
        isLoading: { subscribe: subscribeLoading }, // Export loading state
        setKey: async (provider: string, key: string) => {
            loading = true;
            setLoading(true);
            try {
                console.log(`Setting API key for provider: ${provider}`);
                
                const response = await fetch('/api/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ service: provider, key })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                
                // Update local store with the new key
                update(keys => ({ ...keys, [provider]: key }));
                
                console.log(`Successfully saved API key for ${provider}`);
            } catch (error) {
                console.error('Error saving API key:', error);
                throw error;
            } finally {
                loading = false;
                setLoading(false);
            }
        },
        deleteKey: async (provider: string) => {
            loading = true;
            setLoading(true);
            try {
                console.log(`Deleting API key for provider: ${provider}`);
                
                const response = await fetch(`/api/keys?service=${provider}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                
                // Update local store by removing the key
                update(keys => {
                    const newKeys = { ...keys };
                    delete newKeys[provider];
                    return newKeys;
                });
                
                console.log(`Successfully deleted API key for ${provider}`);
            } catch (error) {
                console.error('Error deleting API key:', error);
                throw error;
            } finally {
                loading = false;
                setLoading(false);
            }
        },
        // Helper method to get a specific provider's key
        getKey: (provider: string): string | undefined => {
            let currentKeys: ApiKeys = {};
            const unsubscribe = subscribe(keys => {
                currentKeys = keys;
            });
            unsubscribe();
            return currentKeys[provider];
        },
        // Helper method to check if a provider has a key
        hasKey: (provider: string): boolean => {
            let currentKeys: ApiKeys = {};
            const unsubscribe = subscribe(keys => {
                currentKeys = keys;
            });
            unsubscribe();
            return !!currentKeys[provider];
        }
    };
}

export const apiKey = createApiKeyStore();