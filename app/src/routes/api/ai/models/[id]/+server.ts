import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { AIModel } from '$lib/types/types';
import type { RequestHandler } from './$types';

// Helper function to sanitize model data before sending to client
function sanitizeModelData(model: AIModel): AIModel {
    // Create a shallow copy of the model
    const sanitized = { ...model };
    
    // Remove API key completely - we'll retrieve it from user's keys when needed
    delete sanitized.api_key;
    
    return sanitized;
}

export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        if (!params.id) {
            return json({ success: false, error: 'Missing model ID' }, { status: 400 });
        }

        const model = await pb.collection('models').getOne<AIModel>(params.id);
        return json({
            success: true,
            model: sanitizeModelData(model)
        });
    } catch (error) {
        console.error(`Error fetching model ${params.id}:`, error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Model not found'
        }, { status: 404 });
    }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

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
        console.error(`Error updating model ${params.id}:`, error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!params.id) {
            return json({ success: false, error: 'Missing model ID' }, { status: 400 });
        }
        
        await pb.collection('models').delete(params.id);
        
        return json({
            success: true,
            message: `Model ${params.id} deleted successfully`
        });
    } catch (error) {
        console.error(`Error deleting model ${params.id}:`, error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};