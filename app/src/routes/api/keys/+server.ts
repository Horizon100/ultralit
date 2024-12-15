import { json } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase'; // Assuming pb is configured with your PocketBase instance
import { currentUser } from '$lib/pocketbase'; // To access current user
import { CryptoService } from '$lib/crypto'; // Import your CryptoService to decrypt keys

export async function GET({ request }) {
  try {
    // Get the currently authenticated user
    const user = await pb.authStore.model;
    if (currentUser) {
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

async function handleModelSelection(model: AIModel) {
  if ($currentUser) {
      try {
          const success = await modelStore.setSelectedModel($currentUser.id, model);
          if (success) {
              selectedModel = model;
          }
      } catch (error) {
          console.warn('Error selecting model:', error);
      }
  }
  isOpen = false;
  dispatch('select', model);
}