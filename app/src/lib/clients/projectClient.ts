import type { Projects, Threads, User } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { marked } from 'marked';
import { get } from 'svelte/store';
import { threadsStore } from '$lib/stores/threadsStore';
// import { threadListVisibility } from '$lib/clients/threadsClient';
import { fetchTryCatch, validationTryCatch, isFailure, type Result } from '$lib/utils/errorUtils';

marked.setOptions({
	gfm: true,
	breaks: true
	/*
	 * headerIds: false,
	 * mangle: false
	 */
});

function validateAuthentication() {
	return validationTryCatch(() => {
		const user = get(currentUser);
		if (!user) {
			throw new Error('User not authenticated');
		}
		return user;
	}, 'user authentication');
}

export async function fetchProjects(): Promise<Result<Projects[], string>> {
	const result = await fetchTryCatch<{ success: boolean; data: Projects[]; error?: string }>(
		'/api/projects',
		{
			method: 'GET',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			}
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to fetch projects', success: false };
	}

	return { data: result.data.data, error: null, success: true };
}

export async function fetchThreadsForProject(
	projectId: string
): Promise<Result<Threads[], string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const user = authValidation.data;
	const endpoint = `/api/projects/${projectId}/threads`;
	console.log(`Fetching threads from endpoint: ${endpoint}`);

	const result = await fetchTryCatch<
		| {
				threads?: Threads[];
				data?: Threads[];
				error?: string;
		  }
		| Threads[]
	>(endpoint, {
		method: 'GET',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${user.token}`
		}
	});

	if (isFailure(result)) {
		console.error(`Error fetching threads for project ${projectId}:`, result.error);
		return { data: null, error: result.error, success: false };
	}

	const rawData = result.data;
	console.log('Raw API response:', rawData);

	let threads: Threads[] = [];

	// Process different response formats
	if (Array.isArray(rawData)) {
		// Handle case where rawData is directly an array of threads
		threads = [...threads, ...rawData];
	} else {
		// Handle case where rawData is an object with threads or data properties
		if (rawData.threads && Array.isArray(rawData.threads)) {
			threads = [...threads, ...rawData.threads];
		}

		if (rawData.data && Array.isArray(rawData.data)) {
			const dataThreads = rawData.data.filter(
				(dataThread: Threads) => !threads.some((thread) => thread.id === dataThread.id)
			);
			threads = [...threads, ...dataThreads];
		}
	}

	// Update store if threads found
	if (threads.length > 0) {
		threadsStore.update((state) => ({
			...state,
			threads: threads,
			filteredThreads: threads,
			project_id: projectId
		}));
	}

	console.log(`Found ${threads.length} threads for project ${projectId}`);
	return { data: threads, error: null, success: true };
}

export async function createProject(
	projectData: Partial<Projects>
): Promise<Result<Projects, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; data: Projects; error?: string }>(
		'/api/projects',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				name: projectData.name || 'New Project',
				description: projectData.description || ''
			})
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to create project', success: false };
	}

	console.log('Project created:', result.data.data);
	return { data: result.data.data, error: null, success: true };
}

export async function updateProject(
	id: string,
	changes: Partial<Projects>
): Promise<Result<Projects, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; data: Projects; error?: string }>(
		`/api/projects/${id}`,
		{
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(changes)
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to update project', success: false };
	}

	return { data: result.data.data, error: null, success: true };
}

export async function deleteProject(id: string): Promise<Result<void, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; error?: string }>(`/api/projects/${id}`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to delete project', success: false };
	}

	return { data: undefined, error: null, success: true };
}

export async function resetProject(projectId: string): Promise<Result<void, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const projectIdValidation = validationTryCatch(() => {
		if (!projectId) {
			throw new Error('Project ID is required');
		}
		return projectId;
	}, 'project ID validation');

	if (isFailure(projectIdValidation)) {
		return { data: null, error: projectIdValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; error?: string }>(
		`/api/projects/${projectId}`,
		{
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				selected: false
			})
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to reset project', success: false };
	}

	return { data: undefined, error: null, success: true };
}

export async function removeThreadFromProject(
	threadId: string,
	projectId: string
): Promise<Result<void, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; error?: string }>(
		`/api/projects/${projectId}/threads/${threadId}`,
		{
			method: 'DELETE',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to remove thread from project',
			success: false
		};
	}

	return { data: undefined, error: null, success: true };
}

export async function addThreadToProject(
	threadId: string,
	projectId: string
): Promise<Result<void, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; error?: string }>(
		`/api/projects/${projectId}/threads`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ threadId })
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to add thread to project',
			success: false
		};
	}

	return { data: undefined, error: null, success: true };
}

export async function addCollaboratorToProject(
	projectId: string,
	userId: string
): Promise<Result<Projects, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; data: Projects; error?: string }>(
		`/api/projects/${projectId}/collaborators`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ userId })
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to add collaborator to project',
			success: false
		};
	}

	return { data: result.data.data, error: null, success: true };
}

export async function fetchProjectCollaborators(
	projectId: string
): Promise<Result<User[], string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	console.log('Fetching collaborators for project ID:', projectId);

	const result = await fetchTryCatch<{ success: boolean; data: User[]; error?: string }>(
		`/api/projects/${projectId}/collaborators`,
		{
			method: 'GET',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		console.error('Error in fetchProjectCollaborators:', result.error);
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to fetch project collaborators',
			success: false
		};
	}

	console.log('Total users found:', result.data.data.length);
	return { data: result.data.data, error: null, success: true };
}

export async function isUserCollaborator(
	projectId: string,
	userId: string
): Promise<Result<boolean, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{
		success: boolean;
		isCollaborator: boolean;
		error?: string;
	}>(`/api/projects/${projectId}/collaborators/${userId}`, {
		method: 'GET',
		credentials: 'include'
	});

	if (isFailure(result)) {
		console.error('Error checking if user is a collaborator:', result.error);
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to check if user is a collaborator',
			success: false
		};
	}

	return { data: result.data.isCollaborator, error: null, success: true };
}

export async function removeCollaboratorFromProject(
	projectId: string,
	userId: string
): Promise<Result<Projects, string>> {
	const authValidation = validateAuthentication();
	if (isFailure(authValidation)) {
		return { data: null, error: authValidation.error, success: false };
	}

	const result = await fetchTryCatch<{ success: boolean; data: Projects; error?: string }>(
		`/api/projects/${projectId}/collaborators/${userId}`,
		{
			method: 'DELETE',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return {
			data: null,
			error: result.data.error || 'Failed to remove collaborator from project',
			success: false
		};
	}

	return { data: result.data.data, error: null, success: true };
}
