import type { Workspaces } from '$lib/types/types';
import { currentUser } from '../pocketbase';
import { get } from 'svelte/store';

// Helper function to handle fetch API responses
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `API request failed with status ${response.status}`);
	}
	return await response.json();
}

export async function createWorkspace(workspaceData: Partial<Workspaces>): Promise<Workspaces> {
	try {
		console.log('Creating workspace with data:', workspaceData);
		
		const response = await fetch('/api/workspaces', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(workspaceData)
		});
		
		const data = await handleResponse<{ success: boolean; data: Workspaces; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to create workspace');
		}
		
		console.log('Workspace created successfully:', data.data);
		return data.data;
	} catch (error) {
		console.error('Error creating workspace:', error);
		throw error;
	}
}

export async function getWorkspaces(userId: string): Promise<Workspaces[]> {
	try {
		const response = await fetch(`/api/workspaces?userId=${encodeURIComponent(userId)}`, {
			method: 'GET',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; data: Workspaces[]; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to fetch workspaces');
		}
		
		return data.data;
	} catch (error) {
		console.error('Error fetching workspaces:', error);
		throw error;
	}
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
	try {
		const response = await fetch(`/api/workspaces/${workspaceId}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		
		const data = await handleResponse<{ success: boolean; error?: string }>(response);
		
		if (!data.success) {
			throw new Error(data.error || 'Failed to delete workspace');
		}
	} catch (error) {
		console.error('Error deleting workspace:', error);
		throw error;
	}
}

export async function updateWorkspace(
	workspaceId: string,
	data: Partial<Workspaces>
): Promise<Workspaces> {
	try {
		const response = await fetch(`/api/workspaces/${workspaceId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(data)
		});
		
		const responseData = await handleResponse<{ success: boolean; data: Workspaces; error?: string }>(response);
		
		if (!responseData.success) {
			throw new Error(responseData.error || 'Failed to update workspace');
		}
		
		return responseData.data;
	} catch (error) {
		console.error('Error updating workspace:', error);
		throw error;
	}
}