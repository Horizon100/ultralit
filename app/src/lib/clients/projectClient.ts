import type { Projects, Threads, User } from '$lib/types/types';
import { ensureAuthenticated, currentUser} from '$lib/pocketbase';
import { marked } from 'marked';
import { get } from 'svelte/store';
import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
import { threadListVisibility } from '$lib/clients/threadsClient';


marked.setOptions({
	gfm: true,
	breaks: true,
	// headerIds: false,
	// mangle: false
});

async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `API request failed with status ${response.status}`);
	}
	return await response.json();
}

export async function fetchProjects(): Promise<Projects[]> {
	try {
	  const response = await fetch('/api/projects', {
		method: 'GET',
		credentials: 'include',
		headers: {
		  'Content-Type': 'application/json',
		}
	  });
	  
	  const data = await handleResponse<{ success: boolean; data: Projects[] }>(response);
	  return data.data;
	} catch (error) {
	  console.error('Error fetching projects:', error);
	  throw error;
	}
}

export async function fetchThreadsForProject(projectId: string): Promise<Threads[]> {
    try {
        await ensureAuthenticated();
            
        // For project-specific requests, use the projects endpoint
        const endpoint = `/api/projects/${projectId}/threads`;
        console.log(`Fetching threads from endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${get(currentUser)?.token}`
            },
        });

        if (!response.ok) {
            const errorMessage = `Failed to fetch threads for project ${projectId}: ${response.status}`;
            throw new Error(errorMessage);
        }

        const rawData = await response.json();
        console.log('Raw API response:', rawData);

        // Combine both arrays if they exist
        let threads: Threads[] = [];
        
        if (rawData.threads && Array.isArray(rawData.threads)) {
            threads = [...threads, ...rawData.threads];
        }
        
        if (rawData.data && Array.isArray(rawData.data)) {
            // Avoid duplicates when merging
            const dataThreads = rawData.data.filter((dataThread: Threads) => 
                !threads.some(thread => thread.id === dataThread.id)
            );
            threads = [...threads, ...dataThreads];
        }
        
        if (Array.isArray(rawData)) {
            threads = [...threads, ...rawData];
        }

		if (threads.length > 0) {
			threadsStore.update(state => ({
				...state,
				threads: threads,
				filteredThreads: threads,
				project_id: projectId
			}));
		}

        console.log(`Found ${threads.length} threads for project ${projectId}`);
        return threads;
    } catch (error) {
        console.error(`Error fetching threads for project ${projectId}:`, error);
        return [];
    }
}

export async function createProject(projectData: Partial<Projects>): Promise<Projects> {
	try {
		ensureAuthenticated();
		
		const response = await fetch('/api/projects', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				name: projectData.name || 'New Project',
				description: projectData.description || ''
				// The backend will handle setting owner, collaborators, and timestamps
			})
		});
		
		const data = await handleResponse<{ success: boolean; data: Projects; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to create project');
		}
		
		console.log('Project created:', data.data);
		return data.data;
	} catch (error) {
		console.error('Error creating project:', error);
		throw error;
	}
}

export async function updateProject(id: string, changes: Partial<Projects>): Promise<Projects> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(changes)
		});
		
		const data = await handleResponse<{ success: boolean; data: Projects; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to update project');
		}
		
		return data.data;
	} catch (error) {
		console.error('Error updating project:', error);
		throw error;
	}
}

/**
 * Deletes a project by ID after ensuring the user is authenticated
 * @param id - Project ID to delete
 * @returns Promise resolving when deletion is complete
 */
export async function deleteProject(id: string): Promise<void> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to delete project');
		}
	} catch (error) {
		console.error('Error deleting project:', error);
		throw error;
	}
}

export async function resetProject(projectId: string): Promise<void> {
	try {
		ensureAuthenticated();
		if (!projectId) {
			throw new Error('Project ID is required');
		}
		
		const response = await fetch(`/api/projects/${projectId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				selected: false
			})
		});
		
		const data = await handleResponse<{ success: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to reset project');
		}
	} catch (error) {
		console.error('Error resetting project:', error);
		throw error;
	}
}

export async function removeThreadFromProject(threadId: string, projectId: string): Promise<void> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${projectId}/threads/${threadId}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to remove thread from project');
		}
	} catch (error) {
		console.error('Error removing thread from project:', error);
		throw error;
	}
}

export async function addThreadToProject(threadId: string, projectId: string): Promise<void> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${projectId}/threads`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ threadId })
		});
		
		const data = await handleResponse<{ success: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to add thread to project');
		}
	} catch (error) {
		console.error('Error adding thread to project:', error);
		throw error;
	}
}

export async function addCollaboratorToProject(projectId: string, userId: string): Promise<Projects> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${projectId}/collaborators`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ userId })
		});
		
		const data = await handleResponse<{ success: boolean; data: Projects; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to add collaborator to project');
		}
		
		return data.data;
	} catch (error) {
		console.error('Error adding collaborator to project:', error);
		throw error;
	}
}

export async function fetchProjectCollaborators(projectId: string): Promise<User[]> {
	try {
		ensureAuthenticated();
		
		console.log('Fetching collaborators for project ID:', projectId);
		
		const response = await fetch(`/api/projects/${projectId}/collaborators`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; data: User[]; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to fetch project collaborators');
		}
		
		console.log('Total users found:', data.data.length);
		return data.data;
	} catch (error) {
		console.error('Error in fetchProjectCollaborators:', error);
		return []; 
	}
}

export async function isUserCollaborator(projectId: string, userId: string): Promise<boolean> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${projectId}/collaborators/${userId}`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; isCollaborator: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to check if user is a collaborator');
		}
		
		return data.isCollaborator;
	} catch (error) {
		console.error('Error checking if user is a collaborator:', error);
		return false;
	}
}

export async function removeCollaboratorFromProject(projectId: string, userId: string): Promise<Projects> {
	try {
		ensureAuthenticated();
		
		const response = await fetch(`/api/projects/${projectId}/collaborators/${userId}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; data: Projects; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to remove collaborator from project');
		}
		
		return data.data;
	} catch (error) {
		console.error('Error removing collaborator from project:', error);
		throw error;
	}
}