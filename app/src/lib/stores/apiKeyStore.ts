// apiKeyStore.ts
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { pb } from '$lib/pocketbase';
import { currentUser } from '$lib/pocketbase';
import { CryptoService } from '$lib/utils/crypto';

export interface ApiKeys {
	openai?: string;
	anthropic?: string;
	google?: string;
	grok?: string;
	[key: string]: string | undefined;
}

interface EncryptedKeys {
	api_keys: string;
	updated: string;
}

function createApiKeyStore() {
	const { subscribe, set, update } = writable<ApiKeys>({});

	return {
		subscribe,

		// Load keys when the store is created
		async loadKeys() {
			if (!browser) return;

			try {
				const user = await pb.authStore.model;
				if (!user) return;

				const userData = await pb.collection('users').getOne<EncryptedKeys>(user.id);
				if (!userData.api_keys) return;

				const decrypted = await CryptoService.decrypt(userData.api_keys, user.id);

				const keys = JSON.parse(decrypted);
				set(keys); // Update the store with decrypted keys
				console.log('Loaded keys:', keys); // Log the keys after loading
			} catch (error) {
				console.error('Error loading API keys:', error);
				set({});
			}
		},

		async setKey(service: keyof ApiKeys, key: string) {
			if (!browser) return;

			try {
				const user = await pb.authStore.model;
				if (!user) throw new Error('User not authenticated');

				const currentKeys = get(this);
				const updatedKeys = { ...currentKeys, [service]: key };
				const encryptedData = await CryptoService.encrypt(JSON.stringify(updatedKeys), user.id);

				await pb.collection('users').update(user.id, {
					api_keys: encryptedData,
					keys_updated: new Date().toISOString()
				});
				set(updatedKeys); // Update the store with the new key
			} catch (error) {
				console.error('Error saving API key:', error);
				throw error;
			}
		},

		clear() {
			set({});
		}
	};
}

export const apiKey = createApiKeyStore();

// Auto-load keys when user changes
currentUser.subscribe(async (user) => {
	if (user) {
		await apiKey.loadKeys();
	} else {
		apiKey.clear();
	}
});
