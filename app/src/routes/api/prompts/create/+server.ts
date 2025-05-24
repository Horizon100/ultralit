import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, cookies }) => {
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

		// Parse request body
		const body = await request.json();

		if (!body.text || typeof body.text !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid prompt data: text field is required and must be a string'
				},
				{ status: 400 }
			);
		}

		// Create the prompt
		const data = {
			prompt: body.text,
			createdBy: userId
		};

		console.log('Creating new prompt with data:', data);

		const record = await pb.collection('prompts').create(data);

		return json({
			success: true,
			data: record
		});
	} catch (error) {
		console.error('Error creating prompt:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create prompt'
			},
			{ status: 500 }
		);
	}
};
