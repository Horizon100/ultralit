import type { AIModel } from '$lib/types/types';
import type { ProviderType } from '$lib/constants/providers';

/**
 * Creates a new AI model via API
 */
export async function createModel(modelData: Partial<AIModel>, userId: string): Promise<AIModel> {
    try {
        const response = await fetch('/api/ai/models', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model: modelData, userId })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create model: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to create model');
        }
        
        return data.model;
    } catch (error) {
        console.error('Error creating model:', error);
        throw error;
    }
}

/**
 * Updates an existing AI model via API
 */
export async function updateModel(id: string, modelData: Partial<AIModel>): Promise<AIModel> {
    try {
        const response = await fetch(`/api/ai/models/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(modelData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update model: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to update model');
        }
        
        return data.model;
    } catch (error) {
        console.error('Error updating model:', error);
        throw error;
    }
}

/**
 * Deletes an AI model via API
 */
export async function deleteModel(id: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/ai/models/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete model: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to delete model');
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting model:', error);
        throw error;
    }
}

/**
 * Fetches models for a specific user via API
 */
export async function fetchUserModels(userId: string): Promise<AIModel[]> {
    try {
        const response = await fetch(`/api/ai/models?userId=${userId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch user models: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch user models');
        }
        
        return data.models;
    } catch (error) {
        console.error('Error fetching user models:', error);
        throw error;
    }
}

/**
 * Imports a model from a provider via API
 */
export async function importProviderModel(
    provider: ProviderType,
    apiType: string,
    apiKey: string,
    userId: string
): Promise<AIModel> {
    try {
        const response = await fetch(`/api/ai/models/import`, {
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
        
        if (!response.ok) {
            throw new Error(`Failed to import provider model: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to import provider model');
        }
        
        return data.model;
    } catch (error) {
        console.error('Error importing provider model:', error);
        throw error;
    }
}

/**
 * Fetches models from a specific provider for a user via API
 */
export async function fetchProviderModels(
    provider: ProviderType,
    userId: string
): Promise<AIModel[]> {
    try {
        const response = await fetch(`/api/ai/models?provider=${provider}&userId=${userId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch provider models: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch provider models');
        }
        
        return data.models;
    } catch (error) {
        console.error('Error fetching provider models:', error);
        throw error;
    }
}

/**
 * Deletes all models from a specific provider for a user via API
 */
export async function deleteProviderModels(
    provider: ProviderType,
    userId: string
): Promise<boolean> {
    try {
        const response = await fetch(`/api/ai/models/provider/${provider}?userId=${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete provider models: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to delete provider models');
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting provider models:', error);
        throw error;
    }
}

/**
 * Saves a model to the database via API
 */
export async function saveModelToDB(model: AIModel, userId: string): Promise<AIModel> {
    try {
        const response = await fetch(`/api/ai/models/save`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, userId })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save model: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to save model');
        }
        
        return data.model;
    } catch (error) {
        console.error('Error saving model:', error);
        throw error;
    }
}