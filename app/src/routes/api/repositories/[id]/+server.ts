import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPBInstance } from '$lib/server/pocketbase';

// GET: Fetch a specific repository by ID
export const GET: RequestHandler = async ({ params, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const pb = getPBInstance();
        const { id } = params;
        
        // Fetch repository with expand
        const repository = await pb.collection('repositories').getOne(id, {
            expand: 'createdBy,project'
        });
        
        // Check if user has access to this repository
        const isOwner = repository.createdBy === locals.user.id;
        const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        return json(repository);
    } catch (error) {
        console.error('Error fetching repository:', error);
        return json({ error: 'Failed to fetch repository' }, { status: 500 });
    }
};

// PATCH: Update repository details
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const pb = getPBInstance();
        const { id } = params;
        const data = await request.json();
        
        // Fetch current repository
        const repository = await pb.collection('repositories').getOne(id);
        
        // Check if user has write access to this repository
        const isOwner = repository.createdBy === locals.user.id;
        const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Update repository
        const updatedRepository = await pb.collection('repositories').update(id, {
            repoName: data.repoName || repository.repoName,
            repoDescription: data.repoDescription !== undefined ? data.repoDescription : repository.repoDescription,
            repoCollaborators: data.repoCollaborators || repository.repoCollaborators,
            defaultBranch: data.defaultBranch || repository.defaultBranch,
            isPublic: data.isPublic !== undefined ? data.isPublic : repository.isPublic
        });
        
        return json(updatedRepository);
    } catch (error) {
        console.error('Error updating repository:', error);
        return json({ error: 'Failed to update repository' }, { status: 500 });
    }
};

// DELETE: Delete a repository
export const DELETE: RequestHandler = async ({ params, locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const pb = getPBInstance();
        const { id } = params;
        
        // Fetch current repository
        const repository = await pb.collection('repositories').getOne(id);
        
        // Check if user is the owner
        if (repository.createdBy !== locals.user.id) {
            return json({ error: 'Only the repository owner can delete it' }, { status: 403 });
        }
        
        // Delete related resources first (folders, files, commits)
        // Fetch all folders in this repository
        const folders = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}"`
        });
        
        // Delete each folder
        for (const folder of folders.items) {
            await pb.collection('code_folders').delete(folder.id);
        }
        
        // Fetch all files in this repository
        const files = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}"`
        });
        
        // Delete each file
        for (const file of files.items) {
            await pb.collection('code_files').delete(file.id);
        }
        
        // Fetch all commits in this repository
        const commits = await pb.collection('code_commits').getList(1, 1000, {
            filter: `repository="${id}"`
        });
        
        // Delete each commit
        for (const commit of commits.items) {
            await pb.collection('code_commits').delete(commit.id);
        }
        
        // Delete the repository
        await pb.collection('repositories').delete(id);
        
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting repository:', error);
        return json({ error: 'Failed to delete repository' }, { status: 500 });
    }
};