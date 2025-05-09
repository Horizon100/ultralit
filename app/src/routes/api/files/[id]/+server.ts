import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

// GET: Fetch a specific file by ID
export const GET: RequestHandler = async ({ params }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const userId = pb.authStore.model.id;
        
        // Fetch file
        const file = await pb.collection('code_files').getOne(id, {
            expand: 'createdBy,lastEditedBy,repository'
        });
        
        // Check if user has access to the repository
        const repository = file.expand?.repository || await pb.collection('repositories').getOne(file.repository);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        const isPublic = repository.isPublic;
        
        if (!isOwner && !isCollaborator && !isPublic) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        return json(file);
    } catch (error) {
        console.error('Error fetching file:', error);
        return json({ error: 'Failed to fetch file' }, { status: 500 });
    }
};

// PATCH: Update file content and details
export const PATCH: RequestHandler = async ({ params, request }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const data = await request.json();
        const userId = pb.authStore.model.id;
        
        // Fetch file
        const file = await pb.collection('code_files').getOne(id);
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(file.repository);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Check if name is changing and if new name already exists in the same path
        if (data.name && data.name !== file.name) {
            const existingFiles = await pb.collection('code_files').getList(1, 1, {
                filter: `repository="${file.repository}" && branch="${file.branch}" && path="${file.path}" && name="${data.name}" && id!="${id}"`
            });
            
            if (existingFiles.totalItems > 0) {
                return json({ error: 'A file with this name already exists in this location' }, { status: 400 });
            }
            
            // If name changes, update the file language
            const fileExtension = data.name.split('.').pop()?.toLowerCase() || '';
            const languageMap: Record<string, string> = {
                'js': 'javascript',
                'ts': 'typescript',
                'jsx': 'javascript',
                'tsx': 'typescript',
                'html': 'html',
                'css': 'css',
                'json': 'json',
                'md': 'markdown',
                'py': 'python',
                'rb': 'ruby',
                'java': 'java',
                'c': 'c',
                'cpp': 'cpp',
                'go': 'go',
                'rs': 'rust',
                'php': 'php',
                'sql': 'sql',
                'sh': 'shell',
                'yml': 'yaml',
                'yaml': 'yaml',
                'swift': 'swift',
                'kt': 'kotlin'
            };
            
            if (fileExtension in languageMap) {
                data.language = languageMap[fileExtension];
            } else {
                data.language = 'text';
            }
        }
        
        // Calculate new file size if content is updated
        let size = file.size;
        if (data.content) {
            const content = Array.isArray(data.content) ? data.content.join('') : data.content;
            size = new Blob([content]).size;
            
            // Format content as array if it's not already
            if (!Array.isArray(data.content)) {
                data.content = [data.content];
            }
        }
        
        // Update file
        const updatedFile = await pb.collection('code_files').update(id, {
            name: data.name || file.name,
            content: data.content || file.content,
            path: data.path || file.path,
            lastEditedBy: userId,
            size: size,
            language: data.language || file.language
        });
        
        return json(updatedFile);
    } catch (error) {
        console.error('Error updating file:', error);
        return json({ error: 'Failed to update file' }, { status: 500 });
    }
};

// DELETE: Delete a file
export const DELETE: RequestHandler = async ({ params }) => {
    // Check if user is authenticated
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated || !pb.authStore.model) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        const userId = pb.authStore.model.id;
        
        // Fetch file
        const file = await pb.collection('code_files').getOne(id);
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(file.repository);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Delete file
        await pb.collection('code_files').delete(id);
        
        return json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        return json({ error: 'Failed to delete file' }, { status: 500 });
    }
};