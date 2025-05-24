import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

// POST: Merge a source branch into a target branch
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
        if (!data.sourceBranch || !data.targetBranch) {
            return json({ error: 'Source and target branches are required' }, { status: 400 });
        }
        
        // Check if user has write access to the repository
        const repository = await pb.collection('repositories').getOne(id);
        const isOwner = repository.createdBy === userId;
        const isCollaborator = repository.repoCollaborators?.includes(userId);
        
        if (!isOwner && !isCollaborator) {
            return json({ error: 'Access denied' }, { status: 403 });
        }
        
        // Check if both branches exist
        const sourceBranchFolders = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${data.sourceBranch}"`
        });
        
        const targetBranchFolders = await pb.collection('code_folders').getList(1, 1, {
            filter: `repository="${id}" && branch="${data.targetBranch}"`
        });
        
        if (sourceBranchFolders.totalItems === 0) {
            return json({ error: 'Source branch not found' }, { status: 404 });
        }
        
        if (targetBranchFolders.totalItems === 0) {
            return json({ error: 'Target branch not found' }, { status: 404 });
        }
        
        // Get all files from the source branch
        const sourceFiles = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.sourceBranch}"`
        });
        
        // Get all files from the target branch
        const targetFiles = await pb.collection('code_files').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.targetBranch}"`
        });
        
        // Create a map of target files by path+name for easy lookup
        const targetFileMap = new Map();
        targetFiles.items.forEach(file => {
            const key = `${file.path}${file.name}`;
            targetFileMap.set(key, file);
        });
        
        // Track changed files for the commit message
        const changedFiles = [];
        
        // Process each file from the source branch
        for (const sourceFile of sourceFiles.items) {
            const key = `${sourceFile.path}${sourceFile.name}`;
            
            if (targetFileMap.has(key)) {
                // File exists in target branch - update it if different
                const targetFile = targetFileMap.get(key);
                
                // Simple comparison - in a real app you might want a more sophisticated diff
                const sourceContent = Array.isArray(sourceFile.content) ? sourceFile.content.join('') : sourceFile.content;
                const targetContent = Array.isArray(targetFile.content) ? targetFile.content.join('') : targetFile.content;
                
                if (sourceContent !== targetContent) {
                    // Update the target file with source content
                    await pb.collection('code_files').update(targetFile.id, {
                        content: sourceFile.content,
                        lastEditedBy: userId,
                        size: sourceFile.size
                    });
                    
                    changedFiles.push(key);
                }
            } else {
                // File doesn't exist in target branch - create it
                await pb.collection('code_files').create({
                    name: sourceFile.name,
                    content: sourceFile.content,
                    path: sourceFile.path,
                    repository: id,
                    branch: data.targetBranch,
                    createdBy: userId,
                    lastEditedBy: userId,
                    size: sourceFile.size,
                    language: sourceFile.language
                });
                
                changedFiles.push(key);
            }
        }
        
        // Get all folders from the source branch
        const sourceFolders = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.sourceBranch}"`
        });
        
        // Get all folders from the target branch
        const targetFolders = await pb.collection('code_folders').getList(1, 1000, {
            filter: `repository="${id}" && branch="${data.targetBranch}"`
        });
        
        // Create a map of target folders by path+name for easy lookup
        const targetFolderMap = new Map();
        targetFolders.items.forEach(folder => {
            const key = `${folder.path}${folder.name}`;
            targetFolderMap.set(key, folder);
        });
        
        // Process each folder from the source branch
        for (const sourceFolder of sourceFolders.items) {
            const key = `${sourceFolder.path}${sourceFolder.name}`;
            
            if (!targetFolderMap.has(key)) {
                // Folder doesn't exist in target branch - create it
                await pb.collection('code_folders').create({
                    name: sourceFolder.name,
                    path: sourceFolder.path,
                    repository: id,
                    branch: data.targetBranch,
                    createdBy: userId,
                    parent: sourceFolder.parent
                });
            }
        }
        
        // Create a merge commit if any files were changed
        if (changedFiles.length > 0) {
            const commitMessage = data.commitMessage || 
                `Merged branch '${data.sourceBranch}' into '${data.targetBranch}'`;
            
            await pb.collection('code_commits').create({
                message: commitMessage,
                repository: id,
                branch: data.targetBranch,
                author: userId,
                changedFiles: changedFiles,
                hash: Date.now().toString(36).substring(2, 10) // Simple hash for demo
            });
        }
        
        return json({
            success: true,
            changedFilesCount: changedFiles.length,
            changedFiles: changedFiles
        });
    } catch (error) {
        console.error('Error merging branches:', error);
        return json({ error: 'Failed to merge branches' }, { status: 500 });
    }
};