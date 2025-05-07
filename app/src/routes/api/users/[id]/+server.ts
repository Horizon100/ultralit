import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const userId = params.id;
    
    try {
        // Fetch the user
        const user = await pb.collection('users').getOne(userId, {
            fields: 'id,name,username,email,avatar,collectionId,model_preference'
        });
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        return json({
            success: true,
            user: {
                id: user.id,
                name: user.name || '',
                username: user.username || '',
                email: user.email || '',
                avatar: user.avatar || '',
                collectionId: user.collectionId,
                model_preference: user.model_preference || []
            }
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        throw error(404, 'User not found');
    }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
    const userId = params.id;
    
    try {
        // Ensure user exists
        const user = await pb.collection('users').getOne(userId);
        
        if (!user) {
            return json({
                success: false,
                error: 'User not found'
            }, { status: 404 });
        }
        
        // Get data from request
        const data = await request.json();
        
        // Create update data object
        const updateData: Record<string, any> = {};
        
        // Check if model_preference is in the data
        if ('model_preference' in data) {
            updateData.model_preference = data.model_preference;
        }
        
        // Only proceed if we have data to update
        if (Object.keys(updateData).length === 0) {
            return json({
                success: false,
                error: 'No valid fields to update'
            }, { status: 400 });
        }
        
        // Update the user
        const updated = await pb.collection('users').update(userId, updateData);
        
        return json({
            success: true,
            user: {
                id: updated.id,
                model_preference: updated.model_preference || []
            }
        });
    } catch (err) {
        console.error('Error updating user data:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update user'
        }, { status: 400 });
    }
};