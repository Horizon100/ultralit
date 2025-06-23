import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
	console.log(`[HERO GET] Looking for hero with id: ${params.id}`);

	if (!locals.pb.authStore.isValid) {
		console.log('[HERO GET] Not authenticated');
		throw error(401, 'Unauthorized');
	}

	try {
		console.log('[HERO GET] Querying game_heroes collection...');
		const heroes = await pb.collection('game_heroes').getList(1, 1, {
			filter: `user="${params.id}"`,
			expand: 'user'
		});

		if (heroes.items.length === 0) {
			console.log('[HERO GET] No hero found, returning 404');
			throw error(404, 'Hero not found');
		}

		const hero = heroes.items[0];
		console.log('[HERO GET] Found hero:', hero.id);
		return json({ hero });
	} catch (err) {
		console.error('[HERO GET] Error:', err);
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(500, 'Failed to get hero');
	}
};

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	console.log(`[HERO PATCH] Starting update for user: ${params.id}`);
	console.log(`[HERO PATCH] User ID type: ${typeof params.id}`);
	console.log(`[HERO PATCH] Auth valid: ${locals.pb.authStore.isValid}`);
	console.log(`[HERO PATCH] Auth model: ${JSON.stringify(locals.pb.authStore.model)}`);

	if (!locals.pb.authStore.isValid) {
		console.log('[HERO PATCH] Not authenticated');
		throw error(401, 'Unauthorized');
	}

	let updates;
	try {
		updates = await request.json();
		console.log('[HERO PATCH] Parsed updates:', JSON.stringify(updates));
	} catch (parseError) {
		console.error('[HERO PATCH] Failed to parse JSON:', parseError);
		throw error(400, 'Invalid JSON');
	}

	try {
		console.log('[HERO PATCH] About to query game_heroes collection...');

		// First, let's check if the collection exists and we can access it
		console.log('[HERO PATCH] Testing collection access...');
		const testQuery = await pb.collection('game_heroes').getList(1, 1);
		console.log('[HERO PATCH] Collection accessible, total items:', testQuery.totalItems);

		// Now try our specific filter
		console.log(`[HERO PATCH] Searching for user: "${params.id}"`);
		const heroes = await pb.collection('game_heroes').getList(1, 1, {
			filter: `user="${params.id}"`
		});

		console.log('[HERO PATCH] Query result:', {
			totalItems: heroes.totalItems,
			items: heroes.items.length,
			firstItem: heroes.items[0] || 'none'
		});

		let hero;
		if (heroes.items.length === 0) {
			console.log('[HERO PATCH] No existing hero found, creating new one...');

			// Let's also verify the user exists
			try {
				const userExists = await pb.collection('users').getOne(params.id);
				console.log('[HERO PATCH] User exists:', userExists.id);
			} catch (userError) {
				console.error('[HERO PATCH] User does not exist:', userError);
				throw error(404, 'User not found');
			}

			const createData = {
				user: params.id,
				position: updates.position || { x: 320, y: 320 },
				currentMap: updates.currentMap || '',
				currentProject: updates.currentProject || '',
				currentRoom: updates.currentRoom || '',
				currentTable: updates.currentTable || '',
				isMoving: updates.isMoving || false,
				lastSeen: updates.lastSeen || new Date().toISOString()
			};

			console.log('[HERO PATCH] Creating with data:', JSON.stringify(createData));
			hero = await pb.collection('game_heroes').create(createData);
			console.log('[HERO PATCH] Created new hero:', hero.id);
		} else {
			const existingHero = heroes.items[0];
			console.log('[HERO PATCH] Updating existing hero:', existingHero.id);

			const updateData = {
				...(updates.position && { position: updates.position }),
				...(updates.currentMap !== undefined && { currentMap: updates.currentMap }),
				...(updates.currentProject !== undefined && { currentProject: updates.currentProject }),
				...(updates.currentRoom !== undefined && { currentRoom: updates.currentRoom }),
				...(updates.currentTable !== undefined && { currentTable: updates.currentTable }),
				...(updates.isMoving !== undefined && { isMoving: updates.isMoving }),
				lastSeen: updates.lastSeen || new Date().toISOString()
			};

			console.log('[HERO PATCH] Update data:', JSON.stringify(updateData));
			hero = await pb.collection('game_heroes').update(existingHero.id, updateData);
			console.log('[HERO PATCH] Updated hero successfully');
		}

		return json({ hero });
	} catch (err) {
		console.error('[HERO PATCH] Detailed error:', err);

		const errorMessage = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, `Failed to update hero: ${errorMessage}`);
	}
};
