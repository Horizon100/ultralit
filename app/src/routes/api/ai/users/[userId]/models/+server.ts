import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AIModel } from '$lib/types/types';
import * as pbServer from '$lib/server/pocketbase';

function sanitizeModelData(model: AIModel): Omit<AIModel, 'api_key'> {
	return {
		id: model.id,
		name: model.name,
		base_url: model.base_url,
		api_type: model.api_type,
		api_version: model.api_version,
		description: model.description,
		user: model.user,
		created: model.created,
		updated: model.updated,
		provider: model.provider
	};
}

export const GET: RequestHandler = async ({ params, cookies }) => {
	const authCookie = cookies.get('pb_auth');
	if (authCookie) {
		try {
			const authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch (e) {
			console.error('Error parsing auth cookie:', e);
		}
	}

	const userId = params.userId;

	if (!pbServer.pb.authStore.isValid) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	if (pbServer.pb.authStore.model?.id !== userId && !pbServer.pb.authStore.model?.admin) {
		return json({ success: false, error: 'Unauthorized to access these models' }, { status: 403 });
	}

	try {
		const records = await pbServer.pb.collection('models').getFullList<AIModel>({
			filter: `user ~ "${userId}"`,
			sort: '-created'
		});

		const sanitizedModels = records.map(sanitizeModelData);

		return json({ success: true, models: sanitizedModels });
	} catch (error) {
		console.error('Error fetching models for user:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch models'
			},
			{ status: 500 }
		);
	}
};
