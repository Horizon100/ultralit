// src/routes/api/tags/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Update a specific tag
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get the tag to verify ownership
        const tag = await pb.collection('tags').getOne(params.id);
        
        // Check if user is authorized to update this tag
        if (tag.createdBy !== locals.user.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized to modify this tag' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get update data from request
        const data = await request.json();
        
        // Update the tag
        const updatedTag = await pb.collection('tags').update(params.id, data);
        
        return json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};

// Delete a specific tag
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        if (!locals.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Get the tag to verify ownership
        const tag = await pb.collection('tags').getOne(params.id);
        
        // Check if user is authorized to delete this tag
        if (tag.createdBy !== locals.user.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized to delete this tag' }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Delete the tag
        await pb.collection('tags').delete(params.id);
        
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting tag:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
};