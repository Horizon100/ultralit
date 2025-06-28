// src/routes/api/keys/+server.ts
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { CryptoService } from '$lib/utils/crypto';
import { apiTryCatch } from '$lib/utils/errorUtils';

// Type for API keys object
interface ApiKeys {
	openai?: string;
	anthropic?: string;
	google?: string;
	grok?: string;
	deepseek?: string;
	[key: string]: string | undefined;
}

// GET endpoint to fetch API keys
export const GET: RequestHandler = async ({ cookies }) =>
	apiTryCatch(
		async () => {
			// Restore auth inline
			const authCookie = cookies.get('pb_auth');
			if (!authCookie) throw new Error('User not authenticated');

			let authData;
			try {
				authData = JSON.parse(authCookie);
				pbServer.pb.authStore.save(authData.token, authData.model);
			} catch {
				throw new Error('Failed to parse auth cookie');
			}

			if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');
			const user = pbServer.pb.authStore.model;
			if (!user) throw new Error('User not found');

			// Fetch and decrypt keys inline
			let userData;
			try {
				userData = await pbServer.pb.collection('users').getOne(user.id);
			} catch {
				// User might not have keys yet
				return {};
			}

			if (!userData.api_keys) return {};

			let decryptedKeys;
			try {
				decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
			} catch {
				// Fail silently on decryption error
				return {};
			}

			const keys = JSON.parse(decryptedKeys);
			return typeof keys === 'object' && keys !== null ? keys : {};
		},
		'Failed to fetch API keys',
		500
	);

// POST endpoint to save API keys
export const POST: RequestHandler = async ({ request, cookies }) =>
	apiTryCatch(
		async () => {
			// Restore auth inline
			const authCookie = cookies.get('pb_auth');
			if (!authCookie) throw new Error('User not authenticated');

			let authData;
			try {
				authData = JSON.parse(authCookie);
				pbServer.pb.authStore.save(authData.token, authData.model);
			} catch {
				throw new Error('Failed to parse auth cookie');
			}

			if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');
			const user = pbServer.pb.authStore.model;
			if (!user) throw new Error('User not found');

			const data = await request.json();
			const { service, key } = data;

			if (!service || key === undefined) {
				throw new Error('Missing service or key');
			}

			const validProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek'];
			if (!validProviders.includes(service)) {
				throw new Error(`Invalid provider: ${service}`);
			}

			// Fetch existing keys
			let userData;
			let currentKeys: ApiKeys = {};
			try {
				userData = await pbServer.pb.collection('users').getOne(user.id);
				if (userData.api_keys) {
					const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
					currentKeys = JSON.parse(decryptedKeys);
				}
			} catch {
				// no existing keys, continue with empty object
			}

			currentKeys[service] = key;

			const encryptedData = await CryptoService.encrypt(JSON.stringify(currentKeys), user.id);
			await pbServer.pb.collection('users').update(user.id, {
				api_keys: encryptedData,
				keys_updated: new Date().toISOString()
			});

			return {
				success: true,
				service,
				message: `${service} API key saved successfully`
			};
		},
		'Failed to save API key',
		500
	);

// DELETE endpoint to remove an API key
export const DELETE: RequestHandler = async ({ cookies, url }) =>
	apiTryCatch(
		async () => {
			// Restore auth inline
			const authCookie = cookies.get('pb_auth');
			if (!authCookie) throw new Error('User not authenticated');

			let authData;
			try {
				authData = JSON.parse(authCookie);
				pbServer.pb.authStore.save(authData.token, authData.model);
			} catch {
				throw new Error('Failed to parse auth cookie');
			}

			if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');
			const user = pbServer.pb.authStore.model;
			if (!user) throw new Error('User not found');

			const service = url.searchParams.get('service');
			if (!service) {
				throw new Error('Missing service parameter');
			}

			// Fetch existing keys
			let userData;
			let currentKeys: ApiKeys = {};
			try {
				userData = await pbServer.pb.collection('users').getOne(user.id);
				if (userData.api_keys) {
					const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
					currentKeys = JSON.parse(decryptedKeys);
				}
			} catch {
				throw new Error('No API keys found to delete');
			}

			if (!(service in currentKeys)) {
				throw new Error(`No API key found for service: ${service}`);
			}

			delete currentKeys[service];

			const encryptedData = await CryptoService.encrypt(JSON.stringify(currentKeys), user.id);
			await pbServer.pb.collection('users').update(user.id, {
				api_keys: encryptedData,
				keys_updated: new Date().toISOString()
			});

			return {
				success: true,
				service,
				message: `${service} API key deleted successfully`
			};
		},
		'Failed to delete API key',
		500
	);

// OPTIONS handler for CORS (no changes needed)
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
