// src/routes/api/game/heroes/+server.ts
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return apiTryCatch(
		async () => {
			const excludeUserId = url.searchParams.get('exclude');
			let filter = '';

			if (excludeUserId) {
				filter = `user != "${excludeUserId}"`;
			}

			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter,
				expand: 'user',
				sort: 'created'
			});

			return heroes;
		},
		'Failed to fetch heroes',
		500
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return apiTryCatch(
		async () => {
			const { userId } = await request.json();
			const targetUserId = userId || locals.pb.authStore.model?.id;

			if (!targetUserId) {
				throw new Error('User ID required');
			}

			// Check if hero already exists
			const existingHeroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${targetUserId}"`,
				expand: 'user'
			});

			if (existingHeroes.length > 0) {
				return {
					hero: existingHeroes[0],
					message: 'Hero already exists'
				};
			}

			// Get default organization
			const organizations = await locals.pb.collection('game_organizations').getFullList({
				filter: 'name = "Main Organization"',
				limit: 1
			});

			if (organizations.length === 0) {
				throw new Error('Default organization not found. Initialize game world first.');
			}

			const defaultOrg = organizations[0];

			const gridSize = 64;
			const spawnGridX = 5;
			const spawnGridY = 5;
			const spawnPosition = {
				x: spawnGridX * gridSize + gridSize / 2,
				y: spawnGridY * gridSize + gridSize / 2
			};

			const hero = await locals.pb.collection('game_heroes').create({
				user: targetUserId,
				position: spawnPosition,
				organization: [defaultOrg.id],
				currentOrganization: defaultOrg.id,
				currentBuilding: null,
				currentRoom: null,
				currentTable: null,
				isMoving: false,
				activityLog: {
					visitCount: 0,
					visitDuration: 0,
					organizationVisits: [],
					buildingVisits: [],
					roomVisits: [],
					tableVisits: [],
					dialogVisits: []
				},
				lastSeen: new Date().toISOString()
			});

			// Get hero with expanded user info
			const heroWithUser = await locals.pb.collection('game_heroes').getOne(hero.id, {
				expand: 'user'
			});

			return {
				hero: heroWithUser,
				message: 'Hero created successfully'
			};
		},
		'Failed to create hero',
		500
	);
};
