import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, cookies }) => {
    // Restore auth from cookies if available
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
        try {
            const authData = JSON.parse(authCookie);
            pbServer.pb.authStore.save(authData.token, authData.model);
        } catch (e) {
            console.error('Error parsing auth cookie:', e);
        }
    }
    
    // Get model by ID
    const path = url.pathname;
    const modelIdMatch = path.match(/models\/([^/]+)$/);
    
    if (modelIdMatch) {
        const modelId = modelIdMatch[1];
        try {
            const record = await pbServer.pb.collection('models').getOne(modelId);
            return json({ success: true, model: record });
        } catch (error) {
            console.error('Error fetching model:', error);
            return json({ success: false, error: 'Failed to fetch model' }, { status: 404 });
        }
    }
    
    // Get models by provider and user
    const providerUserMatch = path.match(/models\/provider\/([^/]+)\/user\/([^/]+)$/);
    if (providerUserMatch) {
        const provider = providerUserMatch[1];
        const userId = providerUserMatch[2];
        
        try {
            const records = await pbServer.pb.collection('models').getFullList({
                filter: `provider = "${provider}" && user ~ "${userId}"`,
                sort: '-created'
            });
            
            return json({ success: true, models: records });
        } catch (error) {
            console.error('Error fetching models by provider and user:', error);
            return json({ success: false, error: 'Failed to fetch models' }, { status: 500 });
        }
    }
    
    return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
    // Restore auth from cookies
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
        try {
            const authData = JSON.parse(authCookie);
            pbServer.pb.authStore.save(authData.token, authData.model);
        } catch (e) {
            console.error('Error parsing auth cookie:', e);
        }
    }
    
    const path = request.url.split('/').pop();
    
    // Save model endpoint
    if (path === 'save') {
        try {
            const { model, userId } = await request.json();
            
            // Check if user is authenticated
            if (!pbServer.pb.authStore.isValid || pbServer.pb.authStore.model?.id !== userId) {
                return json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
            
            // Check if model already exists
            const existingModels = await pbServer.pb.collection('models').getFullList({
                filter: `api_type = "${model.api_type}" && provider = "${model.provider}" && user ~ "${userId}"`
            });
            
            let savedModel;
            
            if (existingModels.length > 0) {
                const existingModel = existingModels[0];
                savedModel = await pbServer.pb.collection('models').update(existingModel.id, {
                    name: model.name,
                    api_key: model.api_key,
                    base_url: model.base_url,
                    description: model.description || '',
                    api_version: model.api_version || ''
                });
            } else {
                const modelData = {
                    name: model.name,
                    api_key: model.api_key,
                    base_url: model.base_url,
                    api_type: model.api_type,
                    provider: model.provider,
                    description: model.description || '',
                    user: [userId],
                    api_version: model.api_version || ''
                };
                
                savedModel = await pbServer.pb.collection('models').create(modelData);
            }
            
            return json({ success: true, model: savedModel });
        } catch (error) {
            console.error('Error saving model:', error);
            return json({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to save model' 
            }, { status: 500 });
        }
    }
    
    return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};