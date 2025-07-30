import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import type { AIAgent } from '$lib/types/types';
import { error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		console.log('=== AGENTS API GET REQUEST START (NO AUTH) ===');

		// First, let's see what users exist in the database
		try {
			const users = await pb.collection('users').getList(1, 5);
			console.log(
				'👥 Users in database:',
				users.items.map((u) => ({ id: u.id, email: u.email }))
			);

			if (users.items.length > 0) {
				const userId = users.items[0].id;
				console.log('🧪 TESTING: Using first user ID:', userId);

				const agents = await pb.collection('ai_agents').getList<AIAgent>(1, 50, {
					filter: `owner = "${userId}"`
				});

				console.log('6. Query successful!');
				console.log('   - Total items:', agents.totalItems);
				console.log('   - Items returned:', agents.items.length);

				return json({
					success: true,
					data: agents.items,
					debug: {
						usedUserId: userId,
						totalUsers: users.totalItems,
						totalAgents: agents.totalItems
					}
				});
			} else {
				return json({
					success: true,
					data: [],
					debug: 'No users found in database'
				});
			}
		} catch (userError) {
			console.error('❌ USER QUERY ERROR:', userError);
			return json(
				{
					success: false,
					error: 'Failed to query users: ' + userError.message
				},
				{ status: 500 }
			);
		}
	} catch (queryError) {
		console.error('❌ DATABASE ERROR:', queryError);
		return json(
			{
				success: false,
				error: 'Database connection failed: ' + queryError.message
			},
			{ status: 500 }
		);
	}
};

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
