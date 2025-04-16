import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const project = await pb.collection('projects').getOne(params.id);
        
        // Verify access
        if (project.owner !== locals.user.id && 
            !project.collaborators?.includes(locals.user.id)) {
            throw error(403, 'Forbidden');
        }
        
        // Check if user is a collaborator
        const isCollaborator = project.collaborators?.includes(params.userId) || false;
        
        return json({ 
            success: true, 
            isCollaborator,
            data: {
                userId: params.userId,
                projectId: params.id
            }
        });
    } catch (err) {
        throw error(400, err instanceof Error ? err.message : 'Failed to check collaborator status');
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');
    
    try {
        const project = await pb.collection('projects').getOne(params.id);
        
        // Verify ownership
        if (project.owner !== locals.user.id) {
            throw error(403, 'Only project owner can remove collaborators');
        }
        
        // Remove the collaborator
        const updatedCollaborators = project.collaborators?.filter(id => id !== params.userId) || [];
        const updated = await pb.collection('projects').update(params.id, {
            collaborators: updatedCollaborators
        });
        
        return json({ 
            success: true, 
            data: updated
        });
    } catch (err) {
        throw error(400, err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
};