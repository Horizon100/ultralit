import { pb, ensureAuthenticated } from '$lib/pocketbase';
import type { PromptInput } from '$lib/types/types';
import type { RecordModel } from 'pocketbase';

export async function fetchUserPrompts(): Promise<PromptInput[]> {
	try {
		await ensureAuthenticated();
		const currentUserId = pb.authStore.model?.id;
		
		if (!currentUserId) {
			throw new Error('User not authenticated');
		}
		
		const records = await pb.collection('prompts').getFullList({
			filter: `createdBy = "${currentUserId}"`,
			sort: '-created'
		});
		
		// Convert RecordModel to PromptInput with proper type safety
		return records.map(record => ({
			id: record.id,
			createdBy: record.createdBy,
			prompt: record.prompt,
			created: record.created,
			updated: record.updated
		}));
	} catch (error) {
		console.error('Error fetching user prompts:', error);
		throw error;
	}
}

export async function createPrompt(promptText: string): Promise<PromptInput> {
	try {
		await ensureAuthenticated();
		const currentUserId = pb.authStore.model?.id;
		
		if (!currentUserId) {
			throw new Error('User not authenticated');
		}
		
		const data = {
			prompt: promptText,
			createdBy: currentUserId
		};
		
		const record = await pb.collection('prompts').create(data);
		
		// Convert RecordModel to PromptInput with proper type safety
		return {
			id: record.id,
			createdBy: record.createdBy,
			prompt: record.prompt,
			created: record.created,
			updated: record.updated
		};
	} catch (error) {
		console.error('Error creating prompt:', error);
		throw error;
	}
}

export async function updatePrompt(id: string, promptText: string): Promise<PromptInput> {
	try {
		await ensureAuthenticated();
		const currentUserId = pb.authStore.model?.id;
		
		if (!currentUserId) {
			throw new Error('User not authenticated');
		}
		
		// First check if the prompt belongs to the current user
		const prompt = await pb.collection('prompts').getOne(id);
		if (prompt.createdBy !== currentUserId) {
			throw new Error('You can only update your own prompts');
		}
		
		const data = {
			prompt: promptText,
			updated: new Date().toISOString()
		};
		
		const record = await pb.collection('prompts').update(id, data);
		
		// Convert RecordModel to PromptInput with proper type safety
		return {
			id: record.id,
			createdBy: record.createdBy,
			prompt: record.prompt,
			created: record.created,
			updated: record.updated
		};
	} catch (error) {
		console.error('Error updating prompt:', error);
		throw error;
	}
}

export async function deletePrompt(id: string): Promise<boolean> {
	try {
		await ensureAuthenticated();
		const currentUserId = pb.authStore.model?.id;
		
		if (!currentUserId) {
			throw new Error('User not authenticated');
		}
		
		// First check if the prompt belongs to the current user
		const prompt = await pb.collection('prompts').getOne(id);
		if (prompt.createdBy !== currentUserId) {
			throw new Error('You can only delete your own prompts');
		}
		
		await pb.collection('prompts').delete(id);
		return true;
	} catch (error) {
		console.error('Error deleting prompt:', error);
		return false;
	}
}