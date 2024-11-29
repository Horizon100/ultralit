import { pb } from '$lib/pocketbase'; // Import your PocketBase setup
import { CryptoService } from '$lib/crypto'; // Import your CryptoService to decrypt keys
import { json } from '@sveltejs/kit';

// Function to fetch and decrypt user API keys
export async function getUserKeys(userId: string) {
  try {
    // Fetch the user data from PocketBase
    const userData = await pb.collection('users').getOne(userId);
    if (!userData.api_keys) {
      throw new Error('API keys not found');
    }

    // Decrypt the encrypted keys
    const decryptedKeys = await CryptoService.decrypt(userData.api_keys, userId);
    return JSON.parse(decryptedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    throw new Error('Error fetching API keys');
  }
}

// Handle GET request to fetch API keys for the authenticated user
export async function GET({ request }) {
  const user = await pb.authStore.model; // Get the authenticated user

  if (!user) {
    return json({ valid: false, error: 'User not authenticated' }, { status: 401 });
  }

  try {
    // Fetch API keys for the authenticated user
    const userKeys = await getUserKeys(user.id);
    return json(userKeys); // Return the keys as JSON
  } catch (error) {
    return json({ valid: false, error: error.message }, { status: 500 });
  }
}