import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { pbTryCatch, unwrap, apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, cookies }) =>
	apiTryCatch(async () => {
		// Validate authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw new Error('Not authenticated');

		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			throw new Error('Invalid session');
		}

		const userId = pb.authStore.model.id;

		if (!params.id || typeof params.id !== 'string') {
			throw new Error('Invalid prompt ID');
		}

		const result = await pbTryCatch(
			pb.collection('prompts').getOne(params.id),
			'fetch prompt'
		);
		const prompt = unwrap(result);

		if (prompt.createdBy !== userId) {
			throw new Error('Forbidden: You do not have access to this prompt');
		}

		return { success: true, data: prompt };
	}, 'Failed to fetch prompt');

export const PATCH: RequestHandler = async ({ params, request, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw new Error('Not authenticated');

		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			throw new Error('Invalid session');
		}
		const userId = pb.authStore.model.id;

		if (!params.id || typeof params.id !== 'string') {
			throw new Error('Invalid prompt ID');
		}

		const body = await request.json();
		if (!body.text || typeof body.text !== 'string') {
			throw new Error('Invalid prompt data: text field is required and must be a string');
		}

		const fetched = await pbTryCatch(pb.collection('prompts').getOne(params.id), 'fetch prompt');
		const prompt = unwrap(fetched);

		if (prompt.createdBy !== userId) {
			throw new Error('Forbidden: You do not have permission to update this prompt');
		}

		const updated = await pbTryCatch(
			pb.collection('prompts').update(params.id, { prompt: body.text }),
			'update prompt'
		);
		return { success: true, data: unwrap(updated) };
	}, 'Failed to update prompt');

export const DELETE: RequestHandler = async ({ params, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw new Error('Not authenticated');

		const authData = JSON.parse(authCookie);
		pb.authStore.save(authData.token, authData.model);

		if (!pb.authStore.isValid || !pb.authStore.model?.id) {
			throw new Error('Invalid session');
		}
		const userId = pb.authStore.model.id;

		if (!params.id || typeof params.id !== 'string') {
			throw new Error('Invalid prompt ID');
		}

		const fetched = await pbTryCatch(pb.collection('prompts').getOne(params.id), 'fetch prompt');
		const prompt = unwrap(fetched);

		if (prompt.createdBy !== userId) {
			throw new Error('Forbidden: Only the owner can delete this prompt');
		}

		await pbTryCatch(pb.collection('prompts').delete(params.id), 'delete prompt');
		return { success: true };
	}, 'Failed to delete prompt');
