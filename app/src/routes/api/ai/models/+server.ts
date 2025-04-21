import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { AIModel } from '$lib/types/types';
import type { RequestHandler } from './$types';
import { providers } from '$lib/constants/providers';

// Helper function to extract endpoint from path
function extractEndpoint(url: URL): { command: string; params: Record<string, string> } {
    const pathParts = url.pathname.split('/');
    const aiIndex = pathParts.indexOf('ai');
    const modelsIndex = pathParts.indexOf('models');
    
    if (aiIndex === -1 || modelsIndex === -1 || modelsIndex !== aiIndex + 1) {
        return { command: '', params: {} };
    }
    
    // The remainder is the actual endpoint we want to handle
    const remainingParts = pathParts.slice(modelsIndex + 1);
    const command = remainingParts.join('/');
    
    // Extract dynamic parameters (e.g., model ID)
    const params: Record<string, string> = {};
    if (remainingParts.length >= 1 && remainingParts[0]) {
        params.id = remainingParts[0];
    }
    
    if (remainingParts.length >= 2 && remainingParts[0] === 'provider') {
        params.provider = remainingParts[1];
    }
    
    if (remainingParts.length >= 4 && remainingParts[2] === 'user') {
        params.userId = remainingParts[3];
    }
    
    return { command, params };
}

// Helper function to sanitize model data before sending to client
function sanitizeModelData(model: AIModel): AIModel {
    // Create a shallow copy of the model
    const sanitized = { ...model };
    
    // Remove API key completely - we'll retrieve it from user's keys when needed
    delete sanitized.api_key;
    
    return sanitized;
}

// Helper function to get API key for a provider from user's saved keys
async function getApiKeyForProvider(userId: string, provider: string): Promise<string | null> {
    try {
        // Get user record to access keys
        const user = await pb.collection('users').getOne(userId);
        
        // Extract the API key for the provider
        const keys = user.api_keys || {};
        return keys[provider] || null;
    } catch (error) {
        console.error(`Error getting API key for provider ${provider}:`, error);
        return null;
    }
}

// Handler for GET requests
export const GET: RequestHandler = async ({ url, request, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const { command, params } = extractEndpoint(url);
        console.log('Models API GET:', { command, params });
        
        // Handle specific model by ID
        if (params.id && !command.includes('/')) {
            try {
                const model = await pb.collection('models').getOne<AIModel>(params.id);
                return json({ success: true, model: sanitizeModelData(model) });
            } catch (error) {
                console.error(`Error fetching model ${params.id}:`, error);
                return json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Model not found'
                }, { status: 404 });
            }
        }
        
        // Handle provider models for a user
        if (command.startsWith('provider') && params.provider && params.userId) {
            const models = await pb.collection('models').getFullList<AIModel>({
                filter: `provider = "${params.provider}" && user ~ "${params.userId}"`,
                sort: '-created'
            });
            
            // Sanitize all models before sending to client
            const sanitizedModels = models.map(sanitizeModelData);
            
            return json({
                success: true,
                models: sanitizedModels
            });
        }
        
        // Handle models for a user (from URL parameters or query params)
        const userId = params.userId || url.searchParams.get('userId');
        const provider = params.provider || url.searchParams.get('provider');
        
        let filter = '';
        
        // Build filter based on params
        if (userId && provider) {
            filter = `provider = "${provider}" && user ~ "${userId}"`;
        } else if (userId) {
            filter = `user ~ "${userId}"`;
        } else if (provider) {
            filter = `provider = "${provider}"`;
        }
        
        const models = await pb.collection('models').getFullList<AIModel>({
            filter,
            sort: '-created'
        });
        
        // Sanitize all models before sending to client
        const sanitizedModels = models.map(sanitizeModelData);
        
        return json({
            success: true,
            models: sanitizedModels
        });
    } catch (error) {
        console.error('Error in models API GET:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

// Handler for POST requests
export const POST: RequestHandler = async ({ url, request, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const { command, params } = extractEndpoint(url);
        console.log('Models API POST:', { command, params });
        
        // Get request body
        const body = await request.json();
        
        // Handle both model/userId format and direct format
        const model = body.model || body;
        const userId = body.userId || locals.user.id;
        
        if (!model || !userId) {
            return json({ success: false, error: 'Missing model or userId' }, { status: 400 });
        }
        
        // Check if model already exists
        const existingModels = await pb.collection('models').getFullList<AIModel>({
            filter: `api_type = "${model.api_type}" && provider = "${model.provider}" && user ~ "${userId}"`
        });
        
        // Get the API key from the user's saved keys instead of storing it with the model
        const apiKey = await getApiKeyForProvider(userId, model.provider);
        
        let savedModel: AIModel;
        
        // Set base URL from providers if available
        const baseUrl = model.base_url || 
                       (providers[model.provider] ? providers[model.provider].baseUrl : '');
        
        if (existingModels.length > 0) {
            // Update existing model
            const existingModel = existingModels[0];
            savedModel = await pb.collection('models').update(existingModel.id, {
                name: model.name,
                api_type: model.api_type,
                provider: model.provider,
                base_url: baseUrl,
                description: model.description || '',
                api_version: model.api_version || ''
                // Not storing API key with model
            });
        } else {
            // Create new model
            const modelData = {
                name: model.name,
                api_type: model.api_type,
                provider: model.provider,
                base_url: baseUrl,
                description: model.description || '',
                user: [userId],
                api_version: model.api_version || ''
                // Not storing API key with model
            };
            
            savedModel = await pb.collection('models').create(modelData);
        }
        
        return json({
            success: true,
            model: sanitizeModelData(savedModel)
        });
    } catch (error) {
        console.error('Error in models API POST:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

// Handler for PATCH requests
export const PATCH: RequestHandler = async ({ url, request, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const { command, params } = extractEndpoint(url);
        console.log('Models API PATCH:', { command, params });
        
        // We need an ID for PATCH operations
        if (!params.id) {
            return json({ success: false, error: 'Missing model ID' }, { status: 400 });
        }
        
        const modelData = await request.json();
        
        // Remove API key from data to be updated
        if (modelData.api_key) {
            delete modelData.api_key;
        }
        
        const updatedModel = await pb.collection('models').update<AIModel>(params.id, modelData);
        
        return json({
            success: true,
            model: sanitizeModelData(updatedModel)
        });
    } catch (error) {
        console.error('Error in models API PATCH:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

// Handler for DELETE requests
export const DELETE: RequestHandler = async ({ url, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const { command, params } = extractEndpoint(url);
        console.log('Models API DELETE:', { command, params });
        
        // Delete a specific model by ID
        if (params.id && !command.includes('/')) {
            await pb.collection('models').delete(params.id);
            
            return json({
                success: true,
                message: `Model ${params.id} deleted successfully`
            });
        }
        
        // Delete all models for a specific provider and user
        if (command.startsWith('provider') && params.provider) {
            const userId = params.userId || url.searchParams.get('userId');
            
            if (!userId) {
                return json({ success: false, error: 'Missing userId' }, { status: 400 });
            }
            
            const modelsToDelete = await pb.collection('models').getFullList<AIModel>({
                filter: `provider = "${params.provider}" && user ~ "${userId}"`
            });
            
            // Delete each model
            await Promise.all(modelsToDelete.map(model => 
                pb.collection('models').delete(model.id)
            ));
            
            return json({
                success: true,
                message: `Deleted ${modelsToDelete.length} models for provider ${params.provider}`
            });
        }
        
        return json({ success: false, error: 'Invalid delete operation' }, { status: 400 });
    } catch (error) {
        console.error('Error in models API DELETE:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};