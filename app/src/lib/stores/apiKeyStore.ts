// lib/stores/apiKeyStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
import {
	clientTryCatch,
	fetchTryCatch,
	tryCatchSync,
	validationTryCatch
} from '$lib/utils/errorUtils';

export interface ApiKeys {
	openai?: string;
	anthropic?: string;
	google?: string;
	grok?: string;
	deepseek?: string;
	[key: string]: string | undefined;
}

type ApiKeyResponse = {
	success: boolean;
	data?: Record<string, string>;
	keys?: Record<string, string>;
	error?: string;
};
type KeysData =
	| Record<string, string>
	| {
			success: boolean;
			data?: Record<string, string>;
			keys?: Record<string, string>;
			[key: string]: unknown;
	  };
export async function debugCompleteApiKeyFlow() {
	console.log('=== COMPLETE API KEY FLOW DEBUG ===');

	// Step 1: Test the raw server endpoint
	console.log('1. Testing raw server endpoint...');
	try {
		const response = await fetch('/api/keys', {
			method: 'GET',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		console.log('   - Status:', response.status);
		console.log('   - OK:', response.ok);

		const rawData = await response.json();
		console.log('   - Raw response:', rawData);
		console.log('   - Raw type:', typeof rawData);
		console.log('   - Raw keys:', Object.keys(rawData || {}));

		// Step 2: Test fetchTryCatch wrapper
		console.log('2. Testing with fetchTryCatch...');
		const fetchResult = await fetch('/api/keys', { credentials: 'include' });
		const fetchData = await fetchResult.json();

		console.log('   - fetchTryCatch would receive:', fetchData);

		// Step 3: Simulate the store's processing logic
		console.log('3. Simulating store processing...');
		let keys: KeysData = fetchData;

		if (keys && typeof keys === 'object') {
			console.log('   - Keys is object, checking structure...');

			if (keys.success && keys.data && typeof keys.data === 'object') {
				console.log('   - Found keys.success + keys.data structure');
				keys = keys.data;
				console.log('   - Extracted keys from data:', Object.keys(keys));
			} else if (keys.success && keys.keys && typeof keys.keys === 'object') {
				console.log('   - Found keys.success + keys.keys structure');
				keys = keys.keys;
				console.log('   - Extracted keys from keys:', Object.keys(keys));
			} else if (!keys.success && !keys.data) {
				console.log('   - Using keys directly (no wrapper)');
				console.log('   - Direct keys:', Object.keys(keys));
			} else {
				console.log('   - Unexpected structure, using empty object');
				console.log('   - Available fields:', Object.keys(keys));
				keys = {};
			}
		}

		// Step 4: Test validation
		console.log('4. Testing validation...');
		const validProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek'];
		const cleanKeys: Record<string, string> = {};

		Object.entries(keys).forEach(([provider, key]) => {
			console.log(
				`   - Checking ${provider}: ${typeof key}, valid provider: ${validProviders.includes(provider)}, has value: ${!!key}`
			);
			if (validProviders.includes(provider) && typeof key === 'string' && key.length > 0) {
				cleanKeys[provider] = key;
				console.log(`   - ✅ Added ${provider} to clean keys`);
			} else {
				console.log(`   - ❌ Rejected ${provider}`);
			}
		});

		console.log('5. Final clean keys:', cleanKeys);
		console.log('6. Clean keys count:', Object.keys(cleanKeys).length);

		return cleanKeys;
	} catch (error) {
		console.error('Error in flow debug:', error);
	}
}

// Also add this function to test if you have any keys stored at all:
export async function testAddApiKey() {
	console.log('=== TESTING ADD API KEY ===');

	try {
		// Add a test key
		const response = await fetch('/api/keys', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				service: 'openai',
				key: 'sk-test-key-123456789' // Replace with a real key if you want to test
			})
		});

		console.log('Add key response status:', response.status);
		const addResult = await response.json();
		console.log('Add key result:', addResult);

		// Now test fetching keys again
		const fetchResponse = await fetch('/api/keys', {
			credentials: 'include'
		});
		const fetchResult = await fetchResponse.json();
		console.log('Keys after adding:', fetchResult);
	} catch (error) {
		console.error('Error testing add key:', error);
	}
}

function createApiKeyStore() {
	const { subscribe, set, update } = writable<ApiKeys>({});
	let initialized = false;
	let loading = false;

	// Create a separate loading state store
	const { subscribe: subscribeLoading, set: setLoading } = writable<boolean>(false);

	// Define which pages need API keys
	const chatPages = ['/chat', '/canvas', '/ide'];

	function shouldLoadKeys(): boolean {
		if (!browser) return false;

		const result = tryCatchSync(() => {
			return chatPages.some((path) => window.location.pathname.startsWith(path));
		});

		if (!result.success) {
			console.error('Error checking if should load keys:', result.error);
			return false;
		}

		return result.data;
	}

	async function loadKeys(force = false) {
		// Only load if we're on a page that needs API keys (unless forced)
		if (!force && !shouldLoadKeys()) {
			console.log('Skipping API key loading - not on a chat page');
			return;
		}

		if (!browser || (initialized && !force) || loading) return;
		loading = true;
		setLoading(true);

		const result = await clientTryCatch(
			(async () => {
				const isAuthenticated = await ensureAuthenticated();
				if (!isAuthenticated) {
					set({});
					return;
				}

				const response = await fetchTryCatch<ApiKeyResponse>('/api/keys', {
					credentials: 'include'
				});

				if (!response.success) {
					console.error('Failed to load API keys:', response.error);
					set({});
					return;
				}

				let keys: KeysData = response.data;

				if (keys && typeof keys === 'object') {
					// If response is {success: true, data: {actualKeys}}, extract the keys
					if (
						'success' in keys &&
						keys.success &&
						'data' in keys &&
						keys.data &&
						typeof keys.data === 'object'
					) {
						keys = keys.data;
						console.log('Extracted API keys from response.data:', Object.keys(keys));
					}
					// If response is {success: true, keys: {actualKeys}}, extract the keys
					else if (
						'success' in keys &&
						keys.success &&
						'keys' in keys &&
						keys.keys &&
						typeof keys.keys === 'object'
					) {
						keys = keys.keys;
						console.log('Extracted API keys from response.keys:', Object.keys(keys));
					}
					// If response already contains the keys directly
					else if (!('success' in keys) && !('data' in keys)) {
						console.log('Using API keys directly from response:', Object.keys(keys));
					}
					// If response is still wrapped, log and use empty object
					else {
						console.warn('Unexpected API key response structure:', keys);
						console.log('Setting empty keys object');
						keys = {};
					}
				} else {
					console.warn('Invalid API key response - not an object:', typeof keys);
					keys = {};
				}

				console.log('Final API keys to store:', Object.keys(keys));

				// Validate keys format
				const validationResult = validationTryCatch(() => {
					if (typeof keys !== 'object' || keys === null) {
						throw new Error('Invalid keys format received');
					}

					// Filter out any non-string values and non-provider keys
					const validProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek'];
					const cleanKeys: ApiKeys = {};

					Object.entries(keys).forEach(([provider, key]) => {
						if (validProviders.includes(provider) && typeof key === 'string' && key.length > 0) {
							cleanKeys[provider] = key;
						}
					});

					return cleanKeys;
				});

				if (validationResult.success) {
					set(validationResult.data);
					initialized = true;
					console.log(
						'Successfully loaded API keys for providers:',
						Object.keys(validationResult.data)
					);
				} else {
					console.warn('Invalid keys format received:', keys);
					set({});
				}
			})(),
			'Failed to load API keys'
		);

		if (!result.success) {
			console.error('Error loading API keys:', result.error);
			set({});
		}

		loading = false;
		setLoading(false);
	}

	// Subscribe to user changes, but only load keys if on appropriate page
	currentUser.subscribe((user) => {
		const subscribeResult = tryCatchSync(() => {
			if (user && shouldLoadKeys()) {
				loadKeys();
			} else if (!user) {
				set({});
				initialized = false;
			}
		});

		if (!subscribeResult.success) {
			console.error('Error in user subscription handler:', subscribeResult.error);
		}
	});

	return {
		subscribe,
		loadKeys,
		isLoading: { subscribe: subscribeLoading },
		// Add method to ensure keys are loaded when needed
		ensureLoaded: async () => {
			const result = await clientTryCatch(
				(async () => {
					if (!initialized) {
						console.log('🔍 API keys not initialized, loading now...');
						await loadKeys(true); // Force load
					}
				})(),
				'Failed to ensure keys are loaded'
			);

			if (!result.success) {
				console.error('Error ensuring keys are loaded:', result.error);
			}
		},
		setKey: async (provider: string, key: string) => {
			loading = true;
			setLoading(true);

			const result = await clientTryCatch(
				(async () => {
					console.log(`Setting API key for provider: ${provider}`);

					const response = await fetchTryCatch<ApiKeyResponse>('/api/keys', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						credentials: 'include',
						body: JSON.stringify({ service: provider, key })
					});

					if (!response.success) {
						throw new Error(response.error);
					}

					// Update local store with the new key
					update((keys) => ({ ...keys, [provider]: key }));

					console.log(`Successfully saved API key for ${provider}`);
				})(),
				`Failed to set API key for ${provider}`
			);

			loading = false;
			setLoading(false);

			if (!result.success) {
				console.error('Error saving API key:', result.error);
				throw new Error(result.error);
			}
		},
		deleteKey: async (provider: string) => {
			loading = true;
			setLoading(true);

			const result = await clientTryCatch(
				(async () => {
					console.log(`Deleting API key for provider: ${provider}`);

					const response = await fetchTryCatch<ApiKeyResponse>(`/api/keys?service=${provider}`, {
						method: 'DELETE',
						credentials: 'include'
					});

					if (!response.success) {
						throw new Error(response.error);
					}

					// Update local store by removing the key
					update((keys) => {
						const newKeys = { ...keys };
						delete newKeys[provider];
						return newKeys;
					});

					console.log(`Successfully deleted API key for ${provider}`);
				})(),
				`Failed to delete API key for ${provider}`
			);

			loading = false;
			setLoading(false);

			if (!result.success) {
				console.error('Error deleting API key:', result.error);
				throw new Error(result.error);
			}
		},
		// Helper method to get a specific provider's key
		getKey: (provider: string): string | undefined => {
			const result = tryCatchSync(() => {
				let currentKeys: ApiKeys = {};
				const unsubscribe = subscribe((keys) => {
					currentKeys = keys;
				});
				unsubscribe();
				return currentKeys[provider];
			});

			if (!result.success) {
				console.error('Error getting API key:', result.error);
				return undefined;
			}

			return result.data;
		},
		// Helper method to check if a provider has a key
		hasKey: (provider: string): boolean => {
			const result = tryCatchSync(() => {
				let currentKeys: ApiKeys = {};
				const unsubscribe = subscribe((keys) => {
					currentKeys = keys;
				});
				unsubscribe();
				return !!currentKeys[provider];
			});

			if (!result.success) {
				console.error('Error checking if provider has key:', result.error);
				return false;
			}

			return result.data;
		}
	};
}

export const apiKey = createApiKeyStore();
