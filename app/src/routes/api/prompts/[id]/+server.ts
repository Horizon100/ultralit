import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, cookies }) => {
	try {
		// Validate authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			return json(
				{
					success: false,
					error: 'Not authenticated'
				},
				{ status: 401 }
			);
		}

		// Load auth store
		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			return json(
				{
					success: false,
					error: 'Invalid session'
				},
				{ status: 401 }
			);
		}

		const userId = pb.authStore.model.id;

		// Validate ID format
		if (!params.id || typeof params.id !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid prompt ID'
				},
				{ status: 400 }
			);
		}

		// Fetch the prompt
		const prompt = await pb.collection('prompts').getOne(params.id);

		// Verify ownership
		if (prompt.createdBy !== userId) {
			return json(
				{
					success: false,
					error: 'Forbidden: You do not have access to this prompt'
				},
				{ status: 403 }
			);
		}

		return json({
			success: true,
			data: prompt
		});
	} catch (error) {
		console.error('Error fetching prompt:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json(
				{
					success: false,
					error: `Prompt not found`
				},
				{ status: 404 }
			);
		}

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch prompt'
			},
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	try {
		// Validate authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			return json(
				{
					success: false,
					error: 'Not authenticated'
				},
				{ status: 401 }
			);
		}

		// Load auth store
		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			return json(
				{
					success: false,
					error: 'Invalid session'
				},
				{ status: 401 }
			);
		}

		const userId = pb.authStore.model.id;

		// Validate ID format
		if (!params.id || typeof params.id !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid prompt ID'
				},
				{ status: 400 }
			);
		}

		// Parse request body
		const body = await request.json();
		console.log('PATCH request body:', body);

		if (!body.text || typeof body.text !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid prompt data: text field is required and must be a string'
				},
				{ status: 400 }
			);
		}

		// First fetch the prompt to verify ownership
		let prompt;
		try {
			prompt = await pb.collection('prompts').getOne(params.id);
		} catch (fetchErr) {
			if (fetchErr instanceof Error && fetchErr.message.includes('not found')) {
				return json(
					{
						success: false,
						error: `Prompt with ID ${params.id} not found`
					},
					{ status: 404 }
				);
			}
			throw fetchErr;
		}

		// Verify ownership
		if (prompt.createdBy !== userId) {
			return json(
				{
					success: false,
					error: 'Forbidden: You do not have permission to update this prompt'
				},
				{ status: 403 }
			);
		}

		// Update the prompt
		const updatedPrompt = await pb.collection('prompts').update(params.id, {
			prompt: body.text
		});

		return json({
			success: true,
			data: updatedPrompt
		});
	} catch (error) {
		console.error('Error updating prompt:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json(
				{
					success: false,
					error: `Prompt not found`
				},
				{ status: 404 }
			);
		}

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to update prompt'
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		// Validate authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			return json(
				{
					success: false,
					error: 'Not authenticated'
				},
				{ status: 401 }
			);
		}

		// Load auth store
		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			return json(
				{
					success: false,
					error: 'Invalid session'
				},
				{ status: 401 }
			);
		}

		const userId = pb.authStore.model.id;

		// Validate ID format
		if (!params.id || typeof params.id !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid prompt ID'
				},
				{ status: 400 }
			);
		}

		// First fetch the prompt to verify ownership
		let prompt;
		try {
			prompt = await pb.collection('prompts').getOne(params.id);
		} catch (fetchErr) {
			if (fetchErr instanceof Error && fetchErr.message.includes('not found')) {
				return json(
					{
						success: false,
						error: `Prompt with ID ${params.id} not found`
					},
					{ status: 404 }
				);
			}
			throw fetchErr;
		}

		// Verify ownership
		if (prompt.createdBy !== userId) {
			return json(
				{
					success: false,
					error: 'Forbidden: Only the owner can delete this prompt'
				},
				{ status: 403 }
			);
		}

		// Delete the prompt
		await pb.collection('prompts').delete(params.id);

		return json({
			success: true
		});
	} catch (error) {
		console.error('Error deleting prompt:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json(
				{
					success: false,
					error: `Prompt not found`
				},
				{ status: 404 }
			);
		}

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to delete prompt'
			},
			{ status: 500 }
		);
	}
};
