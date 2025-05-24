// src/routes/api/game/hero/[userId]/leave/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	try {
		const hero = await pb.collection('game_heroes').getFirstListItem(`user="${params.id}"`);

		// Remove from table if present
		if (hero.currentTable) {
			const table = await pb.collection('game_tables').getOne(hero.currentTable);
			const currentUsers = table.currentUsers || [];
			await pb.collection('game_tables').update(hero.currentTable, {
				currentUsers: currentUsers.filter((id: string) => id !== params.id)
			});
		}

		// Remove from room if present
		if (hero.currentRoom) {
			const room = await pb.collection('game_rooms').getOne(hero.currentRoom);
			const currentUsers = room.currentUsers || [];
			await pb.collection('game_rooms').update(hero.currentRoom, {
				currentUsers: currentUsers.filter((id: string) => id !== params.id)
			});
		}

		// Update hero
		const updatedHero = await pb.collection('game_heroes').update(hero.id, {
			currentTable: null,
			currentRoom: null,
			currentMap: null,
			lastSeen: new Date().toISOString()
		});

		return json({ hero: updatedHero });
	} catch (err) {
		throw error(500, 'Failed to leave location');
	}
};
