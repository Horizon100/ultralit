import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { CryptoService } from '$lib/utils/crypto';

// Helper function to fetch and decrypt user API keys
async function getUserKeys(userId: string) {
	try {
		const userData = await pbServer.pb.collection('users').getOne(userId);
		if (!userData.api_keys) {
			return {}; // Return empty object if no keys found (not an error)
		}

		const decryptedKeys = await CryptoService.decrypt(userData.api_keys, userId);
		return JSON.parse(decryptedKeys);
	} catch (error) {
		console.error('Error fetching API keys:', error);
		throw new Error('Error fetching API keys');
	}
}

// Helper function to restore authentication from cookies
function restoreAuth(cookies: any) {
	const authCookie = cookies.get('pb_auth');
	if (authCookie) {
		try {
			const authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
			return true;
		} catch (e) {
			console.error('Error parsing auth cookie:', e);
			return false;
		}
	}
	return false;
}

// GET endpoint to fetch API keys for the authenticated user
export const GET: RequestHandler = async ({ request, cookies }) => {
	// Restore auth from cookies
	restoreAuth(cookies);

	try {
		// Check if user is authenticated
		if (!pbServer.pb.authStore.isValid) {
			return json({ error: 'User not authenticated' }, { status: 401 });
		}

		const user = pbServer.pb.authStore.model;
		
		// Use the helper function to get keys
		const userKeys = await getUserKeys(user.id);
		return json(userKeys);
	} catch (error) {
		console.error('API keys GET error:', error);
		return json({ 
			error: 'Failed to fetch API keys', 
			details: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
};

// POST endpoint to save API keys
export const POST: RequestHandler = async ({ request, cookies }) => {
	// Restore auth from cookies
	restoreAuth(cookies);

	try {
		// Check if user is authenticated
		if (!pbServer.pb.authStore.isValid) {
			return json({ error: 'User not authenticated' }, { status: 401 });
		}

		const user = pbServer.pb.authStore.model;
		
		const data = await request.json();
		const { service, key } = data;
		
		if (!service || key === undefined) {
			return json({ error: 'Missing service or key' }, { status: 400 });
		}
		
		// Get current keys or initialize empty object
		let currentKeys = {};
		try {
			currentKeys = await getUserKeys(user.id);
		} catch (error) {
			// If keys don't exist yet, we'll create them with an empty object
			console.warn('No existing keys found, creating new key storage');
		}
		
		// Update keys
		currentKeys[service] = key;
		
		// Encrypt and save
		const encryptedData = await CryptoService.encrypt(JSON.stringify(currentKeys), user.id);
		await pbServer.pb.collection('users').update(user.id, {
			api_keys: encryptedData,
			keys_updated: new Date().toISOString()
		});
		
		return json({ 
			success: true,
			service,
			message: 'API key saved successfully'
		});
	} catch (error) {
		console.error('API keys POST error:', error);
		return json({ 
			error: 'Failed to save API key', 
			details: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
};

// DELETE endpoint to remove an API key
export const DELETE: RequestHandler = async ({ request, cookies, url }) => {
	// Restore auth from cookies
	restoreAuth(cookies);

	try {
		// Check if user is authenticated
		if (!pbServer.pb.authStore.isValid) {
			return json({ error: 'User not authenticated' }, { status: 401 });
		}

		const user = pbServer.pb.authStore.model;
		
		// Get service from URL parameter
		const service = url.searchParams.get('service');
		
		if (!service) {
			return json({ error: 'Missing service parameter' }, { status: 400 });
		}
		
		// Get current keys
		let currentKeys = {};
		try {
			currentKeys = await getUserKeys(user.id);
		} catch (error) {
			return json({ error: 'No API keys found to delete' }, { status: 404 });
		}
		
		// Check if the key exists
		if (!(service in currentKeys)) {
			return json({ error: `No API key found for service: ${service}` }, { status: 404 });
		}
		
		// Remove the key
		delete currentKeys[service];
		
		// Encrypt and save
		const encryptedData = await CryptoService.encrypt(JSON.stringify(currentKeys), user.id);
		await pbServer.pb.collection('users').update(user.id, {
			api_keys: encryptedData,
			keys_updated: new Date().toISOString()
		});
		
		return json({ 
			success: true,
			service,
			message: 'API key deleted successfully'
		});
	} catch (error) {
		console.error('API keys DELETE error:', error);
		return json({ 
			error: 'Failed to delete API key', 
			details: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
};

// Handle OPTIONS request for CORS
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
	});
};