import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ cookies }) => {
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

		// Fetch prompts
		const records = await pb.collection('prompts').getFullList({
			filter: `createdBy = "${userId}"`,
			sort: '-created'
		});

		return json({
			success: true,
			data: records
		});
	} catch (error) {
		console.error('Error fetching prompts:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch prompts'
			},
			{ status: 500 }
		);
	}
};
