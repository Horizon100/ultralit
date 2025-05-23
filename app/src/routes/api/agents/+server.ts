// src/routes/api/agents/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, cookies }) => {
	console.log('=== AGENTS API GET REQUEST START ===');
	
	try {
		console.log('1. Checking cookies...');
		const authCookie = cookies.get('pb_auth');
		console.log('2. Auth cookie exists:', !!authCookie);
		
		if (!authCookie) {
			console.log('ERROR: No auth cookie found');
			throw error(401, 'Authentication required');
		}

		console.log('3. Parsing auth cookie...');
		try {
			const authData = JSON.parse(authCookie);
			console.log('Auth data parsed successfully, has token:', !!authData.token);
			pb.authStore.save(authData.token, authData.model);
		} catch (e) {
			console.log('Failed to parse auth cookie, trying loadFromCookie...');
			pb.authStore.loadFromCookie(authCookie);
		}

		console.log('4. Auth store status:');
		console.log('   - Valid:', pb.authStore.isValid);
		console.log('   - Has token:', !!pb.authStore.token);
		console.log('   - Model exists:', !!pb.authStore.model);
		console.log('   - User ID:', pb.authStore.model?.id);

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

		const agents = await pb.collection('ai_agents').getList(1, 50, {
			filter: `owner = "${userId}"`
		});

		console.log('6. Query successful!');
		console.log('   - Total items:', agents.totalItems);
		console.log('   - Items returned:', agents.items.length);

		return json({
			success: true,
			data: agents.items
		});

	} catch (err: any) {
		console.log('=== ERROR IN AGENTS API ===');
		console.log('Error type:', err.constructor.name);
		console.log('Error message:', err.message);
		console.log('Error status:', err.status);
		console.log('Full error:', err);
		
		return json(
			{
				success: false,
				error: err.message || 'Something went wrong while processing your request.'
			},
			{ status: err.status || 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	console.log('=== AGENTS API POST REQUEST START ===');
	
	try {
		console.log('1. Checking authentication...');
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			console.log('ERROR: No auth cookie found');
			throw error(401, 'Authentication required');
		}

		console.log('2. Parsing auth cookie...');
		try {
			const authData = JSON.parse(authCookie);
			pb.authStore.save(authData.token, authData.model);
		} catch (e) {
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
		let agentData: any;

		if (contentType?.includes('multipart/form-data')) {
			agentData = await request.formData();
			agentData.append('owner', userId);
		} else {
			agentData = await request.json();
			agentData.owner = userId;
		}

		console.log('4. Creating agent in database...');
		const newAgent = await pb.collection('ai_agents').create(agentData);

		console.log('5. Agent created successfully:', newAgent.id);
		return json({
			success: true,
			data: newAgent
		});

	} catch (err: any) {
		console.log('=== ERROR IN AGENTS POST API ===');
		console.log('Error:', err);
		return json(
			{
				success: false,
				error: err.message || 'Failed to create agent'
			},
			{ status: err.status || 500 }
		);
	}
};