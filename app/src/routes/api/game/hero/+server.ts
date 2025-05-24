// src/routes/api/game/hero/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// src/routes/api/game/hero/+server.ts
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	const { user, position, currentMap, currentRoom, currentTable, isMoving } = await request.json();

	try {
		// Check if hero already exists
		const existingHeroes = await pb.collection('game_heroes').getList(1, 1, {
			filter: `user="${user}"`
		});

		let hero;
		if (existingHeroes.items.length > 0) {
			// Update existing hero
			hero = await pb.collection('game_heroes').update(existingHeroes.items[0].id, {
				position,
				currentMap,
				currentRoom,
				currentTable,
				isMoving,
				lastSeen: new Date().toISOString()
			});
		} else {
			// Create new hero (removed currentProject requirement)
			hero = await pb.collection('game_heroes').create({
				user,
				position: position || { x: 400, y: 300 }, // Default position
				currentMap,
				currentRoom,
				currentTable,
				isMoving: false,
				lastSeen: new Date().toISOString()
			});
		}

		return json({ hero });
	} catch (err) {
		console.error('[HERO POST] Error:', err);
		throw error(500, 'Failed to create/update hero');
	}
};