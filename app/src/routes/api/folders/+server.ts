// src/routes/api/folders/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const repositoryId = url.searchParams.get('repository');
        const branch = url.searchParams.get('branch');
        
        if (!repositoryId || !branch) {
            return json(
                { error: 'Repository ID and branch are required' },
                { status: 400 }
            );
        }

        // Verify repository access
        const repository = await pb.collection('repositories').getOne(repositoryId);
        const isOwner = repository.createdBy === locals.user.id;
        const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch folders
        const folders = await pb.collection('code_folders').getList(1, 100, {
            filter: `repository="${repositoryId}" && branch="${branch}"`,
            sort: 'path,name'
        });

        return json(folders);
    } catch (error) {
        console.error('Error fetching folders:', error);
        return json(
            { error: 'Failed to fetch folders' },
            { status: 500 }
        );
    }
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.name || !data.repository || !data.branch) {
            return json(
                { error: 'Name, repository, and branch are required' },
                { status: 400 }
            );
        }

        // Verify repository access
        const repository = await pb.collection('repositories').getOne(data.repository);
        const isOwner = repository.createdBy === locals.user.id;
        const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }

        // Create folder
        const folder = await pb.collection('code_folders').create({
            name: data.name,
            path: data.path || '/',
            repository: data.repository,
            branch: data.branch,
            parent: data.parent || null,
            createdBy: locals.user.id
        });

        return json(folder);
    } catch (error) {
        console.error('Error creating folder:', error);
        return json(
            { error: 'Failed to create folder' },
            { status: 500 }
        );
    }
};