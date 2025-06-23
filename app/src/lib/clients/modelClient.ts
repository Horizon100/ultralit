import type { AIModel, ProviderType } from '$lib/types/types';
import { 
	fetchTryCatch, 
	validationTryCatch,
	isFailure,
	type Result 
} from '$lib/utils/errorUtils';

/**
 * Creates a new AI model via API
 */
export async function createModel(modelData: Partial<AIModel>, userId: string): Promise<Result<AIModel, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!userId) {
			throw new Error('User ID is required');
		}
		if (!modelData) {
			throw new Error('Model data is required');
		}
		return { modelData, userId };
	}, 'model creation input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		model?: AIModel;
		error?: string;
	}>('/api/ai/models', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ model: modelData, userId })
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to create model', success: false };
	}

	if (!result.data.model) {
		return { data: null, error: 'No model returned from server', success: false };
	}

	return { data: result.data.model, error: null, success: true };
}

/**
 * Updates an existing AI model via API
 */
export async function updateModel(id: string, modelData: Partial<AIModel>): Promise<Result<AIModel, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!id) {
			throw new Error('Model ID is required');
		}
		if (!modelData) {
			throw new Error('Model data is required');
		}
		return { id, modelData };
	}, 'model update input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		model?: AIModel;
		error?: string;
	}>(`/api/ai/models/${id}`, {
		method: 'PATCH',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(modelData)
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to update model', success: false };
	}

	if (!result.data.model) {
		return { data: null, error: 'No model returned from server', success: false };
	}

	return { data: result.data.model, error: null, success: true };
}

/**
 * Deletes an AI model via API
 */
export async function deleteModel(id: string): Promise<Result<boolean, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!id) {
			throw new Error('Model ID is required');
		}
		return id;
	}, 'model deletion input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		error?: string;
	}>(`/api/ai/models/${id}`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to delete model', success: false };
	}

	return { data: true, error: null, success: true };
}

/**
 * Fetches models for a specific user via API
 */
export async function fetchUserModels(userId: string): Promise<Result<AIModel[], string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!userId) {
			throw new Error('User ID is required');
		}
		return userId;
	}, 'user models fetch input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		models?: AIModel[];
		error?: string;
	}>(`/api/ai/models?userId=${userId}`, {
		method: 'GET',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to fetch user models', success: false };
	}

	return { data: result.data.models || [], error: null, success: true };
}

/**
 * Imports a model from a provider via API
 */
export async function importProviderModel(
	provider: ProviderType,
	apiType: string,
	apiKey: string,
	userId: string
): Promise<Result<AIModel, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!provider) {
			throw new Error('Provider is required');
		}
		if (!apiType) {
			throw new Error('API type is required');
		}
		if (!apiKey) {
			throw new Error('API key is required');
		}
		if (!userId) {
			throw new Error('User ID is required');
		}
		return { provider, apiType, apiKey, userId };
	}, 'provider model import input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		model?: AIModel;
		error?: string;
	}>('/api/ai/models/import', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			provider,
			apiType,
			apiKey,
			userId
		})
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to import provider model', success: false };
	}

	if (!result.data.model) {
		return { data: null, error: 'No model returned from server', success: false };
	}

	return { data: result.data.model, error: null, success: true };
}

/**
 * Fetches models from a specific provider for a user via API
 */
export async function fetchProviderModels(
	provider: ProviderType,
	userId: string
): Promise<Result<AIModel[], string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!provider) {
			throw new Error('Provider is required');
		}
		if (!userId) {
			throw new Error('User ID is required');
		}
		return { provider, userId };
	}, 'provider models fetch input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		models?: AIModel[];
		error?: string;
	}>(`/api/ai/models?provider=${provider}&userId=${userId}`, {
		method: 'GET',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to fetch provider models', success: false };
	}

	return { data: result.data.models || [], error: null, success: true };
}

/**
 * Deletes all models from a specific provider for a user via API
 */
export async function deleteProviderModels(
	provider: ProviderType,
	userId: string
): Promise<Result<boolean, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!provider) {
			throw new Error('Provider is required');
		}
		if (!userId) {
			throw new Error('User ID is required');
		}
		return { provider, userId };
	}, 'provider models deletion input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		error?: string;
	}>(`/api/ai/models/provider/${provider}?userId=${userId}`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to delete provider models', success: false };
	}

	return { data: true, error: null, success: true };
}

/**
 * Saves a model to the database via API
 */
export async function saveModelToDB(model: AIModel, userId: string): Promise<Result<AIModel, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!model) {
			throw new Error('Model is required');
		}
		if (!userId) {
			throw new Error('User ID is required');
		}
		return { model, userId };
	}, 'model save input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		model?: AIModel;
		error?: string;
	}>('/api/ai/models/save', {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ model, userId })
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to save model', success: false };
	}

	if (!result.data.model) {
		return { data: null, error: 'No model returned from server', success: false };
	}

	return { data: result.data.model, error: null, success: true };
}