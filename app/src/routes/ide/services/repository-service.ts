import type { CodeFiles, CodeFolders, Repository, CodeCommits } from '$lib/types/types.ide';
import { pb } from '$lib/server/pocketbase';

// Repository operations
export async function getRepositories(projectId?: string, userId?: string): Promise<Repository[]> {
	try {
		let query = '/api/repositories';
		const params = new URLSearchParams();

		if (projectId) {
			params.append('projectId', projectId);
		}

		if (userId) {
			params.append('userId', userId);
		}

		if (params.toString()) {
			query += `?${params.toString()}`;
		}

		const response = await fetch(query);
		if (!response.ok) {
			throw new Error('Failed to fetch repositories');
		}

		const data = await response.json();
		return data.items as Repository[];
	} catch (error) {
		console.error('Error fetching repositories:', error);
		throw error;
	}
}

export async function getRepository(id: string): Promise<Repository> {
	try {
		const response = await fetch(`/api/repositories/${id}`);
		if (!response.ok) {
			throw new Error('Failed to fetch repository');
		}

		return (await response.json()) as Repository;
	} catch (error) {
		console.error('Error fetching repository:', error);
		throw error;
	}
}

export async function createRepository(data: Partial<Repository>): Promise<Repository> {
	try {
		const response = await fetch('/api/repositories', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to create repository');
		}

		return (await response.json()) as Repository;
	} catch (error) {
		console.error('Error creating repository:', error);
		throw error;
	}
}

export async function updateRepository(id: string, data: Partial<Repository>): Promise<Repository> {
	try {
		const response = await fetch(`/api/repositories/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to update repository');
		}

		return (await response.json()) as Repository;
	} catch (error) {
		console.error('Error updating repository:', error);
		throw error;
	}
}

export async function deleteRepository(id: string): Promise<void> {
	try {
		const response = await fetch(`/api/repositories/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error('Failed to delete repository');
		}
	} catch (error) {
		console.error('Error deleting repository:', error);
		throw error;
	}
}

// Collaborator operations
export async function getCollaborators(repositoryId: string): Promise<any[]> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/collaborators`);
		if (!response.ok) {
			throw new Error('Failed to fetch collaborators');
		}

		return await response.json();
	} catch (error) {
		console.error('Error fetching collaborators:', error);
		throw error;
	}
}

export async function addCollaborator(repositoryId: string, userId: string): Promise<any> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/collaborators`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId })
		});

		if (!response.ok) {
			throw new Error('Failed to add collaborator');
		}

		return await response.json();
	} catch (error) {
		console.error('Error adding collaborator:', error);
		throw error;
	}
}

export async function removeCollaborator(repositoryId: string, userId: string): Promise<any> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/collaborators/${userId}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error('Failed to remove collaborator');
		}

		return await response.json();
	} catch (error) {
		console.error('Error removing collaborator:', error);
		throw error;
	}
}

// Folder operations
export async function getFolders(
	repositoryId: string,
	branch?: string,
	parentId?: string
): Promise<CodeFolders[]> {
	try {
		const params = new URLSearchParams({
			repositoryId
		});

		if (branch) {
			params.append('branch', branch);
		}

		if (parentId) {
			params.append('parentId', parentId);
		}

		const response = await fetch(`/api/ide/folders?${params.toString()}`);
		if (!response.ok) {
			throw new Error('Failed to fetch folders');
		}

		const data = await response.json();
		return data.items as CodeFolders[];
	} catch (error) {
		console.error('Error fetching folders:', error);
		throw error;
	}
}

export async function createFolder(data: Partial<CodeFolders>): Promise<CodeFolders> {
	try {
		const response = await fetch('/api/ide/folders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to create folder');
		}

		return (await response.json()) as CodeFolders;
	} catch (error) {
		console.error('Error creating folder:', error);
		throw error;
	}
}

export async function updateFolder(id: string, data: Partial<CodeFolders>): Promise<CodeFolders> {
	try {
		const response = await fetch(`/api/ide/folders/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to update folder');
		}

		return (await response.json()) as CodeFolders;
	} catch (error) {
		console.error('Error updating folder:', error);
		throw error;
	}
}

export async function deleteFolder(id: string): Promise<void> {
	try {
		const response = await fetch(`/api/ide/folders/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error('Failed to delete folder');
		}
	} catch (error) {
		console.error('Error deleting folder:', error);
		throw error;
	}
}

// File operations
export async function getFiles(
	repositoryId: string,
	branch?: string,
	path?: string
): Promise<CodeFiles[]> {
	try {
		const params = new URLSearchParams({
			repositoryId
		});

		if (branch) {
			params.append('branch', branch);
		}

		if (path) {
			params.append('path', path);
		}

		const response = await fetch(`/api/files?${params.toString()}`);
		if (!response.ok) {
			throw new Error('Failed to fetch files');
		}

		const data = await response.json();
		return data.items as CodeFiles[];
	} catch (error) {
		console.error('Error fetching files:', error);
		throw error;
	}
}

export async function getFile(id: string): Promise<CodeFiles> {
	try {
		const response = await fetch(`/api/files/${id}`);
		if (!response.ok) {
			throw new Error('Failed to fetch file');
		}

		return (await response.json()) as CodeFiles;
	} catch (error) {
		console.error('Error fetching file:', error);
		throw error;
	}
}

export async function createFile(data: Partial<CodeFiles>): Promise<CodeFiles> {
	try {
		const response = await fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to create file');
		}

		return (await response.json()) as CodeFiles;
	} catch (error) {
		console.error('Error creating file:', error);
		throw error;
	}
}

export async function updateFile(id: string, data: Partial<CodeFiles>): Promise<CodeFiles> {
	try {
		const response = await fetch(`/api/files/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to update file');
		}

		return (await response.json()) as CodeFiles;
	} catch (error) {
		console.error('Error updating file:', error);
		throw error;
	}
}

export async function deleteFile(id: string): Promise<void> {
	try {
		const response = await fetch(`/api/files/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error('Failed to delete file');
		}
	} catch (error) {
		console.error('Error deleting file:', error);
		throw error;
	}
}

// Commit operations
export async function getCommits(repositoryId: string, branch?: string): Promise<CodeCommits[]> {
	try {
		const params = new URLSearchParams({
			repositoryId
		});

		if (branch) {
			params.append('branch', branch);
		}

		const response = await fetch(`/api/commits?${params.toString()}`);
		if (!response.ok) {
			throw new Error('Failed to fetch commits');
		}

		const data = await response.json();
		return data.items as CodeCommits[];
	} catch (error) {
		console.error('Error fetching commits:', error);
		throw error;
	}
}

export async function createCommit(data: Partial<CodeCommits>): Promise<CodeCommits> {
	try {
		const response = await fetch('/api/commits', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error('Failed to create commit');
		}

		return (await response.json()) as CodeCommits;
	} catch (error) {
		console.error('Error creating commit:', error);
		throw error;
	}
}

// Branch operations
export async function getBranches(repositoryId: string): Promise<any[]> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/branches`);
		if (!response.ok) {
			throw new Error('Failed to fetch branches');
		}

		return await response.json();
	} catch (error) {
		console.error('Error fetching branches:', error);
		throw error;
	}
}

export async function createBranch(
	repositoryId: string,
	name: string,
	sourceBranch: string
): Promise<any> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/branches`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name,
				sourceBranch
			})
		});

		if (!response.ok) {
			throw new Error('Failed to create branch');
		}

		return await response.json();
	} catch (error) {
		console.error('Error creating branch:', error);
		throw error;
	}
}

export async function setDefaultBranch(repositoryId: string, branch: string): Promise<any> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/branches/${branch}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				setAsDefault: true
			})
		});

		if (!response.ok) {
			throw new Error('Failed to set default branch');
		}

		return await response.json();
	} catch (error) {
		console.error('Error setting default branch:', error);
		throw error;
	}
}

export async function deleteBranch(repositoryId: string, branch: string): Promise<void> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/branches/${branch}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error('Failed to delete branch');
		}
	} catch (error) {
		console.error('Error deleting branch:', error);
		throw error;
	}
}

export async function mergeBranches(
	repositoryId: string,
	sourceBranch: string,
	targetBranch: string,
	commitMessage?: string
): Promise<any> {
	try {
		const response = await fetch(`/api/repositories/${repositoryId}/merge`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				sourceBranch,
				targetBranch,
				commitMessage
			})
		});

		if (!response.ok) {
			throw new Error('Failed to merge branches');
		}

		return await response.json();
	} catch (error) {
		console.error('Error merging branches:', error);
		throw error;
	}
}
