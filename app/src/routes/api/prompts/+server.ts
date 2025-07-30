import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { pbTryCatch, unwrap, apiTryCatch } from '$lib/utils/errorUtils';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
	return apiTryCatch(async () => {
		// Validate authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			throw new Error('Not authenticated');
		}

		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			throw new Error('Invalid session');
		}

		const userId = pb.authStore.model.id;

		const result = await pbTryCatch(
			pb.collection('prompts').getFullList({
				filter: `createdBy = "${userId}"`,
				sort: '-created'
			}),
			'fetch prompts'
		);

		return unwrap(result);
	}, 'Failed to fetch prompts');
};
