import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { v4 as uuidv4 } from 'uuid';

// GET: Fetch commits, optionally filtered by repository and branch
export const GET: RequestHandler = async ({ url }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const userId = pb.authStore.model.id;
        
        // Get query parameters
        const repositoryId = url.searchParams.get('repositoryId');
        const branch = url.searchParams.get('branch');
        
        if (!repositoryId) {
            return json({ error: 'Repository ID is required' }, { status: 400 });
        }
        
        // Check if user has access to the repository
        const repository = await pb.collection('repositories').getOne(repositoryId);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Build filter
        const filters = [`repository="${repositoryId}"`];
        
        if (branch) {
            filters.push(`branch="${branch}"`);
        } else {
            // Default to the repository's default branch
            filters.push(`branch="${repository.defaultBranch}"`);
        }
        
        const filter = filters.join(' && ');
        
        // Fetch commits
        const commits = await pb.collection('code_commits').getList(1, 50, {
            filter,
            sort: '-created',
            expand: 'author'
        });
        
        return json(commits);
    } catch (error) {
        console.error('Error fetching commits:', error);
        return json({ error: 'Failed to fetch commits' }, { status: 500 });
    }
};

// POST: Create a new commit
export const POST: RequestHandler = async ({ request }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const data = await request.json();
        const userId = pb.authStore.model.id;
        
        // Validate required fields
        if (!data.message || !data.repository || !data.changedFiles) {
            return json({ error: 'Commit message, repository, and changed files are required' }, { status: 400 });
        }
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(data.repository);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Use the default branch if not specified
        const branch = data.branch || repository.defaultBranch;
        
        // Generate a commit hash (simplified for demo)
        const commitHash = uuidv4().substring(0, 8);
        
        // Create new commit
        const commit = await pb.collection('code_commits').create({
            message: data.message,
            repository: data.repository,
            branch: branch,
            author: userId,
            changedFiles: data.changedFiles,
            hash: commitHash
        });
        
        return json(commit);
    } catch (error) {
        console.error('Error creating commit:', error);
        return json({ error: 'Failed to create commit' }, { status: 500 });
    }
};