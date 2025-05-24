// src/routes/api/ai/models/+server.ts - FINAL CORRECTED VERSION
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { AIModel } from '$lib/types/types';
import type { RequestHandler } from './$types';

// Helper function to extract endpoint from path
function extractEndpoint(url: URL): { command: string; params: Record<string, string> } {
    const pathParts = url.pathname.split('/');
    const aiIndex = pathParts.indexOf('ai');
    const modelsIndex = pathParts.indexOf('models');
    
    if (aiIndex === -1 || modelsIndex === -1 || modelsIndex !== aiIndex + 1) {
        return { command: '', params: {} };
    }
    
    const remainingParts = pathParts.slice(modelsIndex + 1);
    const command = remainingParts.join('/');
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
function sanitizeModelData(model: AIModel): Omit<AIModel, 'api_key'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { api_key: _, ...sanitized } = model;
    return sanitized;
}



// Handler for GET requests
export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const { command, params } = extractEndpoint(url);
        
        if (params.id && !command.includes('/')) {
            try {
                const model = await pb.collection('models').getOne<AIModel>(params.id);
                
                if (!model.user.includes(locals.user.id)) {
                    return json({ success: false, error: 'Unauthorized access to model' }, { status: 403 });
                }
                
                return json({ success: true, model: sanitizeModelData(model) });
            } catch (error) {
                console.error(`Error fetching model ${params.id}:`, error);
                return json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Model not found'
                }, { status: 404 });
            }
        }
        
        if (command.startsWith('provider') && params.provider && params.userId) {
            if (params.userId !== locals.user.id) {
                return json({ success: false, error: 'Unauthorized access to user models' }, { status: 403 });
            }
            
            const models = await pb.collection('models').getFullList<AIModel>({
                filter: `provider = "${params.provider}" && user ~ "${params.userId}"`,
                sort: '-created'
            });
            
            return json({
                success: true,
                models: models.map(sanitizeModelData)
            });
        }
        
        const userId = params.userId || url.searchParams.get('userId');
        const provider = params.provider || url.searchParams.get('provider');
        const targetUserId = userId || locals.user.id;
        
        if (targetUserId !== locals.user.id) {
            return json({ success: false, error: 'Unauthorized access to user models' }, { status: 403 });
        }
        
        let filter = '';
        
        if (targetUserId && provider) {
            filter = `provider = "${provider}" && user ~ "${targetUserId}"`;
        } else if (targetUserId) {
            filter = `user ~ "${targetUserId}"`;
        } else if (provider) {
            filter = `provider = "${provider}"`;
        }
        
        const models = await pb.collection('models').getFullList<AIModel>({
            filter,
            sort: '-created'
        });
        
        return json({
            success: true,
            models: models.map(sanitizeModelData)
        });
    } catch (error) {
        console.error('Error in models API GET:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

// [Rest of your handlers remain exactly the same...]