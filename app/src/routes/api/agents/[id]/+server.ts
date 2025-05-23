// src/routes/api/agents/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
	try {
		// Get auth token from cookies
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			throw error(401, 'Authentication required');
		}

		// Parse the cookie value properly
		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch (_) {
			// Fallback to direct cookie loading
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) {
			throw error(401, 'Invalid authentication');
		}

		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw error(401, 'User ID not found');
		}

		const expand = url.searchParams.get('expand') || '';
		
		const queryOptions: { expand?: string } = {};
		if (expand) {
			queryOptions.expand = expand;
		}

		const agent = await pb.collection('ai_agents').getOne(params.id, queryOptions);

		// Check if user owns this agent - FIXED: using 'owner' instead of 'user_id'
		if (agent.owner !== userId) {
			throw error(403, 'Access denied');
		}

		return json({
			success: true,
			data: agent
		});

	} catch (err) {
		console.error('Error fetching agent:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch agent';
		const statusCode = (err && typeof err === 'object' && 'status' in err) ? (err as any).status : 500;
		
		return json(
			{
				success: false,
				error: errorMessage
			},
			{ status: statusCode }
		);
	}
};

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	try {
		// Get auth token from cookies
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			throw error(401, 'Authentication required');
		}

		// Parse the cookie value properly
		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch (_) {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) {
			throw error(401, 'Invalid authentication');
		}

		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw error(401, 'User ID not found');
		}

		// First, check if user owns this agent
		const existingAgent = await pb.collection('ai_agents').getOne(params.id);
		// FIXED: using 'owner' instead of 'user_id'
		if (existingAgent.owner !== userId) {
			throw error(403, 'Access denied');
		}

		const contentType = request.headers.get('content-type');
		let updateData: FormData | Record<string, any>;

		if (contentType?.includes('multipart/form-data')) {
			updateData = await request.formData();
		} else {
			updateData = await request.json();
		}

		const updatedAgent = await pb.collection('ai_agents').update(params.id, updateData);

		return json({
			success: true,
			data: updatedAgent
		});

	} catch (err) {
		console.error('Error updating agent:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to update agent';
		const statusCode = (err && typeof err === 'object' && 'status' in err) ? (err as any).status : 500;
		
		return json(
			{
				success: false,
				error: errorMessage
			},
			{ status: statusCode }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		// Get auth token from cookies
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			throw error(401, 'Authentication required');
		}

		// Parse the cookie value properly
		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch (_) {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) {
			throw error(401, 'Invalid authentication');
		}

		const userId = pb.authStore.model?.id;
		if (!userId) {
			throw error(401, 'User ID not found');
		}

		// First, check if user owns this agent
		const existingAgent = await pb.collection('ai_agents').getOne(params.id);
		// FIXED: using 'owner' instead of 'user_id'
		if (existingAgent.owner !== userId) {
			throw error(403, 'Access denied');
		}

		await pb.collection('ai_agents').delete(params.id);

		return json({
			success: true
		});

	} catch (err) {
		console.error('Error deleting agent:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete agent';
		const statusCode = (err && typeof err === 'object' && 'status' in err) ? (err as any).status : 500;
		
		return json(
			{
				success: false,
				error: errorMessage
			},
			{ status: statusCode }
		);
	}
};