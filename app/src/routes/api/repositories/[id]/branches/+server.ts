import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

// GET: Fetch all branches for a repository
export const GET: RequestHandler = async ({ params }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const userId = pb.authStore.model.id;
        
        // Check if user has access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        /*
         * Get a unique list of branches from the repository
         * Since we don't have a dedicated branches collection, we'll aggregate from folders and files
         */
        const folderBranches = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}"`,
            fields: 'branch'
        });
        
        const fileBranches = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}"`,
            fields: 'branch'
        });
        
        // Extract branch names and remove duplicates
        const folderBranchNames = folderBranches.items.map(item => item.branch);
        const fileBranchNames = fileBranches.items.map(item => item.branch);
        const allBranches = [...new Set([...folderBranchNames, ...fileBranchNames])];
        
        // Format the response with additional metadata
        const branchesWithMetadata = await Promise.all(allBranches.map(async (branchName) => {
            // Get the latest commit for this branch
            const latestCommit = await pb.collection('code_commits').getList(1, 1, {
                filter: `repository="${id}" && branch="${branchName}"`,
                sort: '-created'
            });
            
            return {
                name: branchName,
                isDefault: branchName === repository.defaultBranch,
                latestCommit: latestCommit.items.length > 0 ? latestCommit.items[0] : null,
                protected: branchName === repository.defaultBranch // Default branch is protected
            };
        }));
        
        return json(branchesWithMetadata);
    } catch (error) {
        console.error('Error fetching branches:', error);
        return json({ error: 'Failed to fetch branches' }, { status: 500 });
    }
};

// POST: Create a new branch
export const POST: RequestHandler = async ({ params, request }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const data = await request.json();
        const userId = pb.authStore.model.id;
        
        // Validate required fields
        if (!data.name || !data.sourceBranch) {
            return json({
                error: 'Branch name and source branch are required'
            }, { status: 400 });
        }
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Check if branch already exists
        const existingFolders = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${data.name}"`
        });
        
        if (existingFolders.totalItems > 0) {
            return json({ error: 'Branch already exists' }, { status: 400 });
        }
        
        // Get all folders from the source branch
        const sourceFolders = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.sourceBranch}"`
        });
        
        // Clone folders to the new branch
        for (const folder of sourceFolders.items) {
            await pb.collection('code_folders').create({
                name: folder.name,
                path: folder.path,
                repository: id,
                branch: data.name,
                createdBy: userId,
                parent: folder.parent
            });
        }
        
        // Get all files from the source branch
        const sourceFiles = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.sourceBranch}"`
        });
        
        // Clone files to the new branch
        for (const file of sourceFiles.items) {
            await pb.collection('code_files').create({
                name: file.name,
                content: file.content,
                path: file.path,
                repository: id,
                branch: data.name,
                createdBy: userId,
                lastEditedBy: userId,
                size: file.size,
                language: file.language
            });
        }
        
        // Create an initial commit for the new branch
        await pb.collection('code_commits').create({
            message: `Created branch '${data.name}' from '${data.sourceBranch}'`,
            repository: id,
            branch: data.name,
            author: userId,
            changedFiles: [],
            hash: Date.now().toString(36).substring(2, 10) // Simple hash for demo
        });
        
        return json({
            success: true,
            branch: {
                name: data.name,
                isDefault: false,
                protected: false
            }
        });
    } catch (error) {
        console.error('Error creating branch:', error);
        return json({ error: 'Failed to create branch' }, { status: 500 });
    }
};