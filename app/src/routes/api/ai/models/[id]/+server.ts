import { pb } from '$lib/server/pocketbase';
import type { AIModel } from '$lib/types/types';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) throw new Error('Unauthorized');
			if (!params.id) throw new Error('Missing model ID');

			const result = await pbTryCatch(
				pb.collection('models').getOne<AIModel>(params.id),
				'fetch model'
			);
			const model = unwrap(result);

			// Inline sanitize: remove api_key before returning
			const { api_key: _, ...sanitized } = model;

			return { success: true, model: sanitized };
		},
		'Failed to fetch model',
		404
	);

export const PATCH: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) throw new Error('Unauthorized');
			if (!params.id) throw new Error('Missing model ID');

			const modelData = await request.json();

			// Inline removal of api_key if present
			if ('api_key' in modelData) {
				delete modelData.api_key;
			}

			const result = await pbTryCatch(
				pb.collection('models').update<AIModel>(params.id, modelData),
				'update model'
			);
			const updatedModel = unwrap(result);

			// Inline sanitize before return
			const { api_key: _, ...sanitized } = updatedModel;

			return { success: true, model: sanitized };
		},
		'Failed to update model',
		500
	);

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) throw new Error('Unauthorized');
			if (!params.id) throw new Error('Missing model ID');

			await pbTryCatch(pb.collection('models').delete(params.id), 'delete model');

			return { success: true, message: `Model ${params.id} deleted successfully` };
		},
		'Failed to delete model',
		500
	);
