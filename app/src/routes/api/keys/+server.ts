import { json } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase'; // Assuming pb is configured with your PocketBase instance
import { currentUser } from '$lib/pocketbase'; // To access current user

export async function GET({ request }) {
  try {
    // Get the currently authenticated user
    const user = await pb.authStore.model;
    if (!user) {
      return json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Fetch the encrypted keys from PocketBase
    const userData = await pb.collection('users').getOne(user.id);
    if (!userData.api_keys) {
      return json({ error: 'No API keys found' }, { status: 404 });
    }

    // Decrypt the keys (assuming you have a CryptoService for decryption)
    const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);

    // Return the decrypted keys
    return json(JSON.parse(decryptedKeys));
  } catch (error) {
    return json({ error: 'Failed to fetch API keys', details: error.message }, { status: 500 });
  }
}