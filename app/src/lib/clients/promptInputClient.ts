import { ensureAuthenticated } from '$lib/pocketbase';
import type { PromptInput } from '$lib/types/types';
import { fetchTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';

type ApiResponse<T> = {
	success: boolean;
	data?: T;
	error?: string;
};

export async function fetchUserPrompts(): Promise<PromptInput[]> {
	await ensureAuthenticated();
	
	const result = await fetchTryCatch<ApiResponse<PromptInput[]>>(
		'/api/prompts',
		{
			method: 'GET',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		console.error('Error fetching prompts:', result.error);
		throw new Error(result.error);
	}

	if (!result.data.success) {
		throw new Error(result.data.error || 'Failed to fetch prompts');
	}

	return result.data.data || [];
}

export async function createPrompt(promptText: string): Promise<PromptInput> {
	await ensureAuthenticated();
	console.log('Creating prompt with text:', promptText);

	const result = await fetchTryCatch<ApiResponse<PromptInput>>(
		'/api/prompts/create',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ text: promptText }),
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		console.error('Error creating prompt:', result.error);
		throw new Error(result.error);
	}

	if (!result.data.success) {
		throw new Error(result.data.error || 'Failed to create prompt');
	}

	if (!result.data.data) {
		throw new Error('No prompt data returned from server');
	}

	return result.data.data;
}

export async function updatePrompt(id: string, promptText: string): Promise<PromptInput> {
	await ensureAuthenticated();
	console.log(`Updating prompt ${id} with text:`, promptText);

	const result = await fetchTryCatch<ApiResponse<PromptInput>>(
		`/api/prompts/${id}`,
		{
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ text: promptText }),
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		console.error('Error updating prompt:', result.error);
		throw new Error(result.error);
	}

	console.log(`Update response received successfully`);

	if (!result.data.success) {
		throw new Error(result.data.error || 'Failed to update prompt');
	}

	if (!result.data.data) {
		throw new Error('No prompt data returned from server');
	}

	return result.data.data;
}

export async function deletePrompt(id: string): Promise<boolean> {
	await ensureAuthenticated();
	console.log(`Deleting prompt with ID: ${id}`);

	const result = await fetchTryCatch<ApiResponse<never>>(
		`/api/prompts/${id}`,
		{
			method: 'DELETE',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		console.error('Error deleting prompt:', result.error);
		
		// Handle specific 404 case
		if (result.error.includes('404') || result.error.includes('not found')) {
			throw new Error(`Prompt with ID ${id} not found.`);
		}
		
		throw new Error(result.error);
	}

	console.log(`Delete response received successfully`);
	return result.data.success;
}