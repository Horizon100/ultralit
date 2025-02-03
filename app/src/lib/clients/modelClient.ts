import { pb } from '../pocketbase';
import type { AIModel } from '$lib/types/types';
import { providers, type ProviderType } from '$lib/constants/providers';

export async function createModel(modelData: Partial<AIModel>): Promise<AIModel> {
	try {
		const model = await pb.collection('models').create<AIModel>(modelData);
		return model;
	} catch (error) {
		console.error('Error creating model:', error);
		throw error;
	}
}

export async function updateModel(id: string, modelData: Partial<AIModel>): Promise<AIModel> {
	try {
		const model = await pb.collection('models').update<AIModel>(id, modelData);
		return model;
	} catch (error) {
		console.error('Error updating model:', error);
		throw error;
	}
}

export async function deleteModel(id: string): Promise<boolean> {
	try {
		await pb.collection('models').delete(id);
		return true;
	} catch (error) {
		console.error('Error deleting model:', error);
		throw error;
	}
}

export async function fetchUserModels(userId: string): Promise<AIModel[]> {
	try {
		const models = await pb.collection('models').getFullList<AIModel>({
			filter: `user ~ "${userId}"`
		});
		return models;
	} catch (error) {
		console.error('Error fetching user models:', error);
		throw error;
	}
}

export async function importProviderModel(
	provider: ProviderType,
	apiType: string,
	apiKey: string,
	userId: string
): Promise<AIModel> {
	try {
		// Check if model already exists for this user
		const existingModels = await pb.collection('models').getFullList<AIModel>({
			filter: `provider = "${provider}" && api_type = "${apiType}" && user ~ "${userId}"`
		});

		const modelData: Partial<AIModel> = {
			name: apiType,
			api_key: apiKey,
			base_url: providers[provider].baseUrl || '',
			api_type: apiType,
			provider: provider,
			user: [userId]
		};

		if (existingModels.length > 0) {
			// Update existing model
			return await updateModel(existingModels[0].id, modelData);
		} else {
			// Create new model
			return await createModel(modelData);
		}
	} catch (error) {
		console.error('Error importing provider model:', error);
		throw error;
	}
}

export async function fetchProviderModels(
	provider: ProviderType,
	userId: string
): Promise<AIModel[]> {
	try {
		const models = await pb.collection('models').getFullList<AIModel>({
			filter: `provider = "${provider}" && user ~ "${userId}"`,
			sort: 'name'
		});
		return models;
	} catch (error) {
		console.error('Error fetching provider models:', error);
		throw error;
	}
}

export async function deleteProviderModels(
	provider: ProviderType,
	userId: string
): Promise<boolean> {
	try {
		const models = await fetchProviderModels(provider, userId);
		await Promise.all(models.map((model) => deleteModel(model.id)));
		return true;
	} catch (error) {
		console.error('Error deleting provider models:', error);
		throw error;
	}
}
