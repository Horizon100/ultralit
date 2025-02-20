import { json } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';
import { currentUser } from '$lib/pocketbase';
import { CryptoService } from '$lib/utils/crypto';
	import { modelStore } from '$lib/stores/modelStore';

export async function GET({ request }) {
	try {
		const user = await pb.authStore.model;
		if (currentUser) {
			return json({ error: 'User not authenticated' }, { status: 401 });
		}
		const userData = await pb.collection('users').getOne(user.id);
		if (!userData.api_keys) {
			return json({ error: 'No API keys found' }, { status: 404 });
		}
		const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
		return json(JSON.parse(decryptedKeys));
	} catch (error) {
		return json({ error: 'Failed to fetch API keys', details: error.message }, { status: 500 });
	}
}

async function handleModelSelection(model: AIModel) {
	if (currentUser) {
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
