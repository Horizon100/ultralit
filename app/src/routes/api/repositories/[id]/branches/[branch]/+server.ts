import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

// GET: Fetch details about a specific branch
export const GET: RequestHandler = async ({ params }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id, branch } = params;
        const userId = pb.authStore.model.id;
        
        // Check if user has access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Get branch details
        // Check if branch exists by finding at least one folder
        const branchFolders = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${branch}"`
        });
        
        if (branchFolders.totalItems === 0) {
            return json({ error: 'Branch not found' }, { status: 404 });
        }
        
        // Get the latest commits for this branch
        const latestCommits = await pb.collection('code_commits').getList(1, 10, {
            filter: `repository="${id}" && branch="${branch}"`,
            sort: '-created',
            expand: 'author'
        });
        
        // Get branch statistics
        const folderCount = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${branch}"`,
            countOnly: true
        });
        
        const fileCount = await pb.collection('code_files').getList(1, 1, {
            filter: `repository="${id}" && branch="${branch}"`,
            countOnly: true
        });
        
        return json({
            name: branch,
            isDefault: branch === repository.defaultBranch,
            protected: branch === repository.defaultBranch,
            commits: latestCommits.items,
            stats: {
                folderCount: folderCount.totalItems,
                fileCount: fileCount.totalItems
            }
        });
    } catch (error) {
        console.error('Error fetching branch details:', error);
        return json({ error: 'Failed to fetch branch details' }, { status: 500 });
    }
};

// PATCH: Update branch (e.g., set as default)
export const PATCH: RequestHandler = async ({ params, request }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id, branch } = params;
        const data = await request.json();
        const userId = pb.authStore.model.id;
        
        // Check if user has admin access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        
        if (!isOwner) {
            return json({ error: 'Only repository owners can update branch settings' }, { status: 403 });
        }
        
        // Check if branch exists
        const branchFolders = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${branch}"`
        });
        
        if (branchFolders.totalItems === 0) {
            return json({ error: 'Branch not found' }, { status: 404 });
        }
        
        // Handle setting as default branch
        if (data.setAsDefault) {
            await pb.collection('repositories').update(id, {
                defaultBranch: branch
            });
        }
        
        return json({
            success: true,
            name: branch,
            isDefault: data.setAsDefault ? true : branch === repository.defaultBranch,
            protected: branch === repository.defaultBranch || data.setAsDefault
        });
    } catch (error) {
        console.error('Error updating branch:', error);
        return json({ error: 'Failed to update branch' }, { status: 500 });
    }
};

// DELETE: Delete a branch
export const DELETE: RequestHandler = async ({ params }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id, branch } = params;
        const userId = pb.authStore.model.id;
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Prevent deletion of default branch
        if (branch === repository.defaultBranch) {
            return json({ error: 'Cannot delete the default branch' }, { status: 400 });
        }
        
        // Get all folders in this branch
        const folders = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}" && branch="${branch}"`
        });
        
        // Delete folders
        for (const folder of folders.items) {
            await pb.collection('code_folders').delete(folder.id);
        }
        
        // Get all files in this branch
        const files = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}" && branch="${branch}"`
        });
        
        // Delete files
        for (const file of files.items) {
            await pb.collection('code_files').delete(file.id);
        }
        
        // Get all commits for this branch
        const commits = await pb.collection('code_commits').getList(1, 1000, {
            filter: `repository="${id}" && branch="${branch}"`
        });
        
        // Delete commits
        for (const commit of commits.items) {
            await pb.collection('code_commits').delete(commit.id);
        }
        
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting branch:', error);
        return json({ error: 'Failed to delete branch' }, { status: 500 });
    }
};