import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// GET: Get all collaborators for a repository
export const GET: RequestHandler = async ({ params, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        
        // Check if user has access to this repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === locals.user.id;
        const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Get collaborator users
        const collaboratorIds = [repository.createdBy, ...(repository.repoCollaborators || [])];
        const uniqueIds = [...new Set(collaboratorIds)]; // Remove duplicates
        
        const collaborators = [];
        for (const userId of uniqueIds) {
            try {
                const user = await pb.collection('users').getOne(userId, {
                    fields: 'id,username,name,avatar'
                });
                collaborators.push({
                    ...user,
                    isOwner: userId === repository.createdBy
                });
            } catch (err) {
                console.error(`Error fetching user ${userId}:`, err);
                // Skip this user if we can't fetch them
            }
        }
        
        return json(collaborators);
    } catch (error) {
        console.error('Error fetching collaborators:', error);
        return json({ error: 'Failed to fetch collaborators' }, { status: 500 });
    }
};

// POST: Add a collaborator to the repository
export const POST: RequestHandler = async ({ params, request, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const data = await request.json();
        
        if (!data.userId) {
            return json({ error: 'User ID is required' }, { status: 400 });
        }
        
        // Check if user is repository owner
        const repository = await pb.collection('repositories').getOne(id);
        if (repository.createdBy !== locals.user.id) {
            return json({ error: 'Only the repository owner can add collaborators' }, { status: 403 });
        }
        
        // Check if user exists
        try {
            await pb.collection('users').getOne(data.userId);
        } catch {
            return json({ error: 'User not found' }, { status: 404 });
        }
        
        // Add collaborator if not already added
        const collaborators = repository.repoCollaborators || [];
        if (!collaborators.includes(data.userId)) {
            collaborators.push(data.userId);
            
            // Update repository
            const updatedRepository = await pb.collection('repositories').update(id, {
                repoCollaborators: collaborators
            });
            
            return json(updatedRepository);
        }
        
        return json(repository);
    } catch (error) {
        console.error('Error adding collaborator:', error);
        return json({ error: 'Failed to add collaborator' }, { status: 500 });
    }
};