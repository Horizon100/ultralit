import { json } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';
import { CryptoService } from '$lib/utils/crypto';

// Helper function to fetch and decrypt user API keys
export async function getUserKeys(userId: string) {
	try {
		const userData = await pb.collection('users').getOne(userId);
		if (!userData.api_keys) {
			throw new Error('API keys not found');
		}

		const decryptedKeys = await CryptoService.decrypt(userData.api_keys, userId);
		return JSON.parse(decryptedKeys);
	} catch (error) {
		console.error('Error fetching API keys:', error);
		throw new Error('Error fetching API keys');
	}
}

// GET endpoint to fetch API keys for the authenticated user
export async function GET({ request }) {
	try {
		const user = await pb.authStore.model;
		if (!user) {
			return json({ error: 'User not authenticated' }, { status: 401 });
		}

		// Use the helper function to get keys
		const userKeys = await getUserKeys(user.id);
		return json(userKeys);
	} catch (error) {
		return json({ 
            error: 'Failed to fetch API keys', 
            details: error.message 
        }, { status: 500 });
	}
}

// Optional: Add PUT/POST endpoint to save API keys
export async function POST({ request }) {
    try {
        const user = await pb.authStore.model;
        if (!user) {
            return json({ error: 'User not authenticated' }, { status: 401 });
        }
        
        const data = await request.json();
        const { service, key } = data;
        
        if (!service || !key) {
            return json({ error: 'Missing service or key' }, { status: 400 });
        }
        
        // Get current keys or initialize empty object
        let currentKeys = {};
        try {
            const userData = await pb.collection('users').getOne(user.id);
            if (userData.api_keys) {
                const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
                currentKeys = JSON.parse(decryptedKeys);
            }
        } catch (error) {
            // If keys don't exist yet, we'll create them
        }
        
        // Update keys
        currentKeys[service] = key;
        
        // Encrypt and save
        const encryptedData = await CryptoService.encrypt(JSON.stringify(currentKeys), user.id);
        await pb.collection('users').update(user.id, {
            api_keys: encryptedData,
            keys_updated: new Date().toISOString()
        });
        
        return json({ success: true });
    } catch (error) {
        return json({ 
            error: 'Failed to save API key', 
            details: error.message 
        }, { status: 500 });
    }
}