
//  src/routes/api/agents/[id]/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import type { AIAgent } from '$lib/types/types';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) =>
	apiTryCatch(async () => {
		console.log('=== AGENTS API GET REQUEST START ===');

		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			console.log('ERROR: No auth cookie found');
			throw error(401, 'Authentication required');
		}

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) {
			console.log('ERROR: Auth store is invalid');
			throw error(401, 'Invalid authentication');
		}

		const userId = pb.authStore.model?.id;
		if (!userId) {
			console.log('ERROR: No user ID found');
			throw error(401, 'User ID not found');
		}

		console.log('5. Querying agents collection...');
		console.log('   - Collection: ai_agents');
		console.log('   - Filter: owner =', userId);

		const agentsResult = await pbTryCatch(
			pb.collection('ai_agents').getList<AIAgent>(1, 50, {
				filter: `owner = "${userId}"`
			}),
			'fetch agents'
		);
		const agents = unwrap(agentsResult);

		console.log('6. Query successful!');
		console.log('   - Total items:', agents.totalItems);
		console.log('   - Items returned:', agents.items.length);
		console.log('   - Actual items:', agents.items);

		/*
		 * Return just the data, not a Response object
		 * apiTryCatch will wrap this in the proper JSON response
		 */
		return agents.items;
	}, 'Failed to fetch agents');

export const POST: RequestHandler = async ({ request, cookies }) =>
	apiTryCatch(async () => {
		console.log('=== AGENTS API POST REQUEST START ===');

		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			console.log('ERROR: No auth cookie found');
			throw error(401, 'Authentication required');
		}

		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch {
			pb.authStore.loadFromCookie(authCookie);
		}

		if (!pb.authStore.isValid) {
			console.log('ERROR: Auth store is invalid');
			throw error(401, 'Invalid authentication');
		}

		const userId = pb.authStore.model?.id;
		if (!userId) {
			console.log('ERROR: No user ID found');
			throw error(401, 'User ID not found');
		}

		console.log('3. Processing request data...');
		const contentType = request.headers.get('content-type');
		let agentData: FormData | Record<string, unknown>;

		if (contentType?.includes('multipart/form-data')) {
			agentData = await request.formData();
			if (agentData instanceof FormData) {
				agentData.append('owner', userId);
			}
		} else {
			agentData = await request.json();
			if (typeof agentData === 'object' && agentData !== null) {
				(agentData as Record<string, unknown>).owner = userId;
			}
		}

		console.log('4. Creating agent in database...');
		const createResult = await pbTryCatch(
			pb.collection('ai_agents').create(agentData),
			'create agent'
		);
		const newAgent = unwrap(createResult);

		console.log('5. Agent created successfully:', newAgent.id);

		// Return just the data, not a Response object
		return newAgent;
	}, 'Failed to create agent');
