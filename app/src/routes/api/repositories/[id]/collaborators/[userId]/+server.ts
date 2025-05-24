import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// DELETE: Remove a collaborator from the repository
export const DELETE: RequestHandler = async ({ params, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id, userId } = params;
        
        // Check if user is repository owner
        const repository = await pb.collection('repositories').getOne(id);
        
        // Allow self-removal or owner can remove anyone
        const isSelfRemoval = userId === locals.user.id;
        const isOwner = repository.createdBy === locals.user.id;
        
        if (!isOwner && !isSelfRemoval) {
            return json({ error: 'Only the repository owner can remove collaborators' }, { status: 403 });
        }
        
        // Cannot remove the owner
        if (userId === repository.createdBy) {
            return json({ error: 'Cannot remove the repository owner' }, { status: 400 });
        }
        
        // Remove collaborator
        let collaborators = repository.repoCollaborators || [];
        collaborators = collaborators.filter((id: string) => id !== userId);
        
        // Update repository
        const updatedRepository = await pb.collection('repositories').update(id, {
            repoCollaborators: collaborators
        });
        
        return json(updatedRepository);
    } catch (error) {
        console.error('Error removing collaborator:', error);
        return json({ error: 'Failed to remove collaborator' }, { status: 500 });
    }
};