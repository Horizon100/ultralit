// src/lib/clients/ideClient.ts
import { get } from 'svelte/store';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
import type { Repository, CodeFolders, CodeFiles, CodeCommits } from '$lib/types/types.ide';
import type { Projects, User } from '$lib/types/types';
import type { RecordModel } from 'pocketbase';
import { projectStore } from '$lib/stores/projectStore';

interface CreateRepositoryParams {
    repoName: string;
    repoDescription?: string;
    isPublic?: boolean;
    defaultBranch?: string;
}
/**
 * Fetches repositories accessible to the current user
 * @param projectId Optional project ID to filter repositories
 * @param userId Optional user ID to filter repositories
 * @param isPublic Optional flag to filter public repositories
 * @returns Promise with the repositories list
 */
export async function fetchRepositories(
    projectId?: string,
    userId?: string,
    isPublic?: boolean
): Promise<Repository[]> {
    try {
        let url = '/api/repositories';
        const params = new URLSearchParams();
        
        if (projectId) params.append('projectId', projectId);
        if (userId) params.append('userId', userId);
        if (isPublic !== undefined) params.append('isPublic', String(isPublic));
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch repositories');
        
        const data = await response.json();
        return data.items || [];
    } catch (err) {
        console.error('Error fetching repositories:', err);
        throw err;
    }
}

/**
 * Creates a new repository
 * @param repoName Name of the repository
 * @param projectId Project ID the repository belongs to
 * @param repoDescription Optional description
 * @param isPublic Optional visibility flag (default: false)
 * @param defaultBranch Optional default branch name (default: 'main')
 * @returns Promise with the created repository
 */
export async function createRepository(repoName: string): Promise<Repository> {
    const user = get(currentUser);
    if (!user) throw new Error('User not authenticated');
    
    const currentProjectId = get(projectStore).currentProjectId;
    if (!currentProjectId) throw new Error('No project selected');

    const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            repoName,
            project: currentProjectId, // Use store's current project
            createdBy: user.id,
            defaultBranch: 'main'
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create repository');
    }

    return response.json();
}

/**
 * Creates a new branch in a repository
 * @param repositoryId ID of the repository
 * @param branchName Name of the new branch
 * @returns Promise with the created folder (root for the branch)
 */
export async function createBranch(
    repositoryId: string,
    branchName: string,
    sourceBranch: string = 'main'
): Promise<{ success: boolean; branch?: any; error?: string }> {
    try {
        const user = get(currentUser);
        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        const response = await fetch(`/api/repositories/${repositoryId}/branches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}` // Add if your API uses auth
            },
            body: JSON.stringify({
                name: branchName,
                sourceBranch: sourceBranch
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return { 
                success: false, 
                error: result.error || 'Failed to create branch' 
            };
        }

        return { 
            success: true, 
            branch: result.branch || {
                name: branchName,
                isDefault: false,
                protected: false
            }
        };
    } catch (err) {
        console.error('Error creating branch:', err);
        return { 
            success: false, 
            error: err instanceof Error ? err.message : 'Failed to create branch' 
        };
    }
}

/**
 * Creates a new folder in a repository branch
 * @param repositoryId ID of the repository
 * @param branchName Name of the branch
 * @param folderName Name of the new folder
 * @param parentFolderId Optional parent folder ID
 * @returns Promise with the created folder
 */
export async function createFolder(
    repositoryId: string,
    branchName: string,
    folderName: string,
    parentFolderId?: string
): Promise<CodeFolders> {
    try {
        const path = parentFolderId ? 
            `${parentFolderId.path}/${folderName}` : 
            `/${folderName}`;
        
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                path,
                repository: repositoryId,
                branch: branchName,
                createdBy: get(currentUser)?.id,
                parent: parentFolderId || null
            })
        });
        
        if (!response.ok) throw new Error('Failed to create folder');
        
        return await response.json();
    } catch (err) {
        console.error('Error creating folder:', err);
        throw err;
    }
}

export async function fetchFolders(repositoryId: string, branch: string) {
    try {
        const response = await fetch(
            `/api/folders?repository=${repositoryId}&branch=${branch}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch folders');
        }
        
        return await response.json();
    } catch (err) {
        console.error('Error fetching folders:', err);
        throw err;
    }
}


/**
 * Fetches files for a repository branch
 * @param repositoryId ID of the repository
 * @param branchName Name of the branch
 * @param path Optional path to filter files
 * @returns Promise with the files list
 */
export async function fetchFiles(
    repositoryId: string,
    branchName: string,
    path?: string
): Promise<CodeFiles[]> {
    try {
        // First ensure we're authenticated
        const isAuthenticated = await ensureAuthenticated();
        if (!isAuthenticated) {
            throw new Error('Not authenticated');
        }

        let url = '/api/files';
        const params = new URLSearchParams();
        
        // Use 'repository' parameter to match server expectation
        params.append('repository', repositoryId);
        params.append('branch', branchName);
        if (path) params.append('path', path);
        
        url += `?${params.toString()}`;
        
        const response = await fetch(url, {
            credentials: 'include' // Include cookies for authentication
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to fetch files');
        }
        
        const data = await response.json();
        return data.items || [];
    } catch (err) {
        console.error('Error fetching files:', {
            error: err,
            repositoryId,
            branchName,
            path
        });
        throw err;
    }
}

/**
 * Creates a new file in a repository branch
 * @param repositoryId ID of the repository
 * @param branchName Name of the branch
 * @param fileName Name of the new file
 * @param content Optional initial content
 * @param path Optional path for the file (default: '/')
 * @returns Promise with the created file
 */
export async function createFile(
    repositoryId: string,
    branchName: string,
    fileName: string,
    content: string[] = [''],
    path: string = '/'
): Promise<CodeFiles> {
    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fileName,
                content,
                path,
                repository: repositoryId,
                branch: branchName,
                createdBy: get(currentUser)?.id,
                language: fileName.split('.').pop() || ''
            })
        });
        
        if (!response.ok) throw new Error('Failed to create file');
        
        return await response.json();
    } catch (err) {
        console.error('Error creating file:', err);
        throw err;
    }
}

/**
 * Updates file content
 * @param fileId ID of the file to update
 * @param content New content for the file
 * @returns Promise with the updated file
 */
export async function updateFile(
    fileId: string,
    content: string[]
): Promise<CodeFiles> {
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                lastEditedBy: get(currentUser)?.id
            })
        });
        
        if (!response.ok) throw new Error('Failed to update file');
        
        return await response.json();
    } catch (err) {
        console.error('Error updating file:', err);
        throw err;
    }
}