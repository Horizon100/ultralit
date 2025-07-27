// src/routes/api/agents/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw error(401, 'Authentication required');

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

		const userId = pb.authStore.model?.id;
		if (!userId) throw error(401, 'User ID not found');

		const expand = url.searchParams.get('expand') || '';
		const queryOptions: { expand?: string } = {};
		if (expand) queryOptions.expand = expand;

		const agentResult = await pbTryCatch(
			pb.collection('ai_agents').getOne(params.id, queryOptions),
			'fetch agent'
		);
		const agent = unwrap(agentResult);

		if (agent.owner !== userId) throw error(403, 'Access denied');

		return json({ success: true, data: agent });
	}, 'Failed to fetch agent');

export const PATCH: RequestHandler = async ({ params, request, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw error(401, 'Authentication required');

		let authData;
		try {
			authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
			authData = { token: pb.authStore.token, model: pb.authStore.model };
		}

		if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

		const userId = pb.authStore.model?.id;
		if (!userId) throw error(401, 'User ID not found');

		// First verify the agent exists and user has access
		const existingResult = await pbTryCatch(
			pb.collection('ai_agents').getOne(params.id),
			'fetch existing agent'
		);
		const existingAgent = unwrap(existingResult);

		if (existingAgent.owner !== userId) throw error(403, 'Access denied');

		const contentType = request.headers.get('content-type');
		let updateData: FormData | Record<string, unknown>;

		if (contentType?.includes('multipart/form-data')) {
			updateData = await request.formData();
			console.log('FormData entries:', Array.from(updateData.entries()));
		} else {
			updateData = await request.json();
			console.log('JSON updateData:', updateData);
		}

		// Ensure the owner field is set correctly
		if (updateData instanceof FormData) {
			updateData.set('owner', userId);
		} else {
			updateData.owner = userId;
		}

		console.log('Sending to PocketBase:', updateData);
		console.log('Auth token being used:', authData.token ? 'Present' : 'Missing');
		console.log('User ID:', userId);

		try {
			// Make sure PocketBase auth is properly set before the update
			pb.authStore.save(authData.token, authData.model);
			
			const updatedResult = await pb.collection('ai_agents').update(params.id, updateData);
			console.log('PocketBase update successful:', updatedResult);
			
			return json({ success: true, data: updatedResult });
		} catch (pbError: any) {
			console.error('PocketBase Error Details:', {
				message: pbError.message,
				status: pbError.status,
				response: pbError.response,
				data: pbError.data,
				originalError: pbError.originalError,
				authValid: pb.authStore.isValid,
				authModel: pb.authStore.model?.id
			});
			
			// Try to get more specific error information
			if (pbError.response?.data) {
				console.error('PocketBase validation errors:', pbError.response.data);
			}
			
			// Re-throw with more context
			throw new Error(`PocketBase update failed: ${pbError.message} - ${JSON.stringify(pbError.response?.data || {})}`);
		}
	}, 'Failed to update agent');
export const DELETE: RequestHandler = async ({ params, cookies }) =>
	apiTryCatch(async () => {
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw error(401, 'Authentication required');

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) throw error(401, 'Invalid authentication');

		const userId = pb.authStore.model?.id;
		if (!userId) throw error(401, 'User ID not found');

		const existingResult = await pbTryCatch(
			pb.collection('ai_agents').getOne(params.id),
			'fetch existing agent'
		);
		const existingAgent = unwrap(existingResult);

		if (existingAgent.owner !== userId) throw error(403, 'Access denied');

		await pbTryCatch(pb.collection('ai_agents').delete(params.id), 'delete agent');

		return json({ success: true });
	}, 'Failed to delete agent');
