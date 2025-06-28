import type { CodeFiles, CodeFolders, Repository, CodeCommits } from '$lib/types/types.ide';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';

// Repository operations
export async function getRepositories(projectId?: string, userId?: string): Promise<Repository[]> {
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

	const result = await clientTryCatch(fetch(query));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch repositories', response.statusText);
			throw new Error('Failed to fetch repositories');
		}
		const data = await response.json();
		return data.items as Repository[];
	} else {
		console.error('Error fetching repositories:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function getRepository(id: string): Promise<Repository> {
	const result = await clientTryCatch(fetch(`/api/repositories/${id}`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch repository', response.statusText);
			throw new Error('Failed to fetch repository');
		}
		return (await response.json()) as Repository;
	} else {
		console.error('Error fetching repository:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function createRepository(data: Partial<Repository>): Promise<Repository> {
	const result = await clientTryCatch(
		fetch('/api/repositories', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to create repository', response.statusText);
			throw new Error('Failed to create repository');
		}
		return (await response.json()) as Repository;
	} else {
		console.error('Error creating repository:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function updateRepository(id: string, data: Partial<Repository>): Promise<Repository> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to update repository', response.statusText);
			throw new Error('Failed to update repository');
		}
		return (await response.json()) as Repository;
	} else {
		console.error('Error updating repository:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function deleteRepository(id: string): Promise<void> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${id}`, {
			method: 'DELETE'
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to delete repository', response.statusText);
			throw new Error('Failed to delete repository');
		}
	} else {
		console.error('Error deleting repository:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

// Collaborator operations
export async function getCollaborators(repositoryId: string): Promise<any[]> {
	const result = await clientTryCatch(fetch(`/api/repositories/${repositoryId}/collaborators`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch collaborators', response.statusText);
			throw new Error('Failed to fetch collaborators');
		}
		return await response.json();
	} else {
		console.error('Error fetching collaborators:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function addCollaborator(repositoryId: string, userId: string): Promise<any> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/collaborators`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId })
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to add collaborator', response.statusText);
			throw new Error('Failed to add collaborator');
		}
		return await response.json();
	} else {
		console.error('Error adding collaborator:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function removeCollaborator(repositoryId: string, userId: string): Promise<any> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/collaborators/${userId}`, {
			method: 'DELETE'
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to remove collaborator', response.statusText);
			throw new Error('Failed to remove collaborator');
		}
		return await response.json();
	} else {
		console.error('Error removing collaborator:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

// Folder operations
export async function getFolders(
	repositoryId: string,
	branch?: string,
	parentId?: string
): Promise<CodeFolders[]> {
	const params = new URLSearchParams({
		repositoryId
	});

	if (branch) {
		params.append('branch', branch);
	}

	if (parentId) {
		params.append('parentId', parentId);
	}

	const result = await clientTryCatch(fetch(`/api/ide/folders?${params.toString()}`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch folders', response.statusText);
			throw new Error('Failed to fetch folders');
		}
		const data = await response.json();
		return data.items as CodeFolders[];
	} else {
		console.error('Error fetching folders:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function createFolder(data: Partial<CodeFolders>): Promise<CodeFolders> {
	const result = await clientTryCatch(
		fetch('/api/ide/folders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to create folder', response.statusText);
			throw new Error('Failed to create folder');
		}
		return (await response.json()) as CodeFolders;
	} else {
		console.error('Error creating folder:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function updateFolder(id: string, data: Partial<CodeFolders>): Promise<CodeFolders> {
	const result = await clientTryCatch(
		fetch(`/api/ide/folders/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to update folder', response.statusText);
			throw new Error('Failed to update folder');
		}
		return (await response.json()) as CodeFolders;
	} else {
		console.error('Error updating folder:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function deleteFolder(id: string): Promise<void> {
	const result = await clientTryCatch(
		fetch(`/api/ide/folders/${id}`, {
			method: 'DELETE'
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to delete folder', response.statusText);
			throw new Error('Failed to delete folder');
		}
	} else {
		console.error('Error deleting folder:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

// File operations
export async function getFiles(
	repositoryId: string,
	branch?: string,
	path?: string
): Promise<CodeFiles[]> {
	const params = new URLSearchParams({
		repositoryId
	});

	if (branch) {
		params.append('branch', branch);
	}

	if (path) {
		params.append('path', path);
	}

	const result = await clientTryCatch(fetch(`/api/files?${params.toString()}`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch files', response.statusText);
			throw new Error('Failed to fetch files');
		}
		const data = await response.json();
		return data.items as CodeFiles[];
	} else {
		console.error('Error fetching files:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function getFile(id: string): Promise<CodeFiles> {
	const result = await clientTryCatch(fetch(`/api/files/${id}`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch file', response.statusText);
			throw new Error('Failed to fetch file');
		}
		return (await response.json()) as CodeFiles;
	} else {
		console.error('Error fetching file:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function createFile(data: Partial<CodeFiles>): Promise<CodeFiles> {
	const result = await clientTryCatch(
		fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to create file', response.statusText);
			throw new Error('Failed to create file');
		}
		return (await response.json()) as CodeFiles;
	} else {
		console.error('Error creating file:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function updateFile(id: string, data: Partial<CodeFiles>): Promise<CodeFiles> {
	const result = await clientTryCatch(
		fetch(`/api/files/${id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to update file', response.statusText);
			throw new Error('Failed to update file');
		}
		return (await response.json()) as CodeFiles;
	} else {
		console.error('Error updating file:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function deleteFile(id: string): Promise<void> {
	const result = await clientTryCatch(
		fetch(`/api/files/${id}`, {
			method: 'DELETE'
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to delete file', response.statusText);
			throw new Error('Failed to delete file');
		}
	} else {
		console.error('Error deleting file:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

// Commit operations
export async function getCommits(repositoryId: string, branch?: string): Promise<CodeCommits[]> {
	const params = new URLSearchParams({
		repositoryId
	});

	if (branch) {
		params.append('branch', branch);
	}

	const result = await clientTryCatch(fetch(`/api/commits?${params.toString()}`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch commits', response.statusText);
			throw new Error('Failed to fetch commits');
		}
		const data = await response.json();
		return data.items as CodeCommits[];
	} else {
		console.error('Error fetching commits:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function createCommit(data: Partial<CodeCommits>): Promise<CodeCommits> {
	const result = await clientTryCatch(
		fetch('/api/commits', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to create commit', response.statusText);
			throw new Error('Failed to create commit');
		}
		return (await response.json()) as CodeCommits;
	} else {
		console.error('Error creating commit:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

// Branch operations
export async function getBranches(repositoryId: string): Promise<any[]> {
	const result = await clientTryCatch(fetch(`/api/repositories/${repositoryId}/branches`));
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to fetch branches', response.statusText);
			throw new Error('Failed to fetch branches');
		}
		return await response.json();
	} else {
		console.error('Error fetching branches:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function createBranch(
	repositoryId: string,
	name: string,
	sourceBranch: string
): Promise<any> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/branches`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name,
				sourceBranch
			})
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to create branch', response.statusText);
			throw new Error('Failed to create branch');
		}
		return await response.json();
	} else {
		console.error('Error creating branch:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function setDefaultBranch(repositoryId: string, branch: string): Promise<any> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/branches/${branch}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				setAsDefault: true
			})
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to set default branch', response.statusText);
			throw new Error('Failed to set default branch');
		}
		return await response.json();
	} else {
		console.error('Error setting default branch:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function deleteBranch(repositoryId: string, branch: string): Promise<void> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/branches/${branch}`, {
			method: 'DELETE'
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to delete branch', response.statusText);
			throw new Error('Failed to delete branch');
		}
	} else {
		console.error('Error deleting branch:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}

export async function mergeBranches(
	repositoryId: string,
	sourceBranch: string,
	targetBranch: string,
	commitMessage?: string
): Promise<any> {
	const result = await clientTryCatch(
		fetch(`/api/repositories/${repositoryId}/merge`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				sourceBranch,
				targetBranch,
				commitMessage
			})
		})
	);
	if (isSuccess(result)) {
		const response = result.data;
		if (!response.ok) {
			console.error('Failed to merge branches', response.statusText);
			throw new Error('Failed to merge branches');
		}
		return await response.json();
	} else {
		console.error('Error merging branches:', result.error);
		throw new Error(result.error ?? 'Unknown error');
	}
}
