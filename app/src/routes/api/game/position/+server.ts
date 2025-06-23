import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	const { userId, position } = await request.json();

	try {
		const heroes = await pb.collection('game_heroes').getList(1, 1, {
			filter: `user="${userId}"`
		});

		let hero;
		if (heroes.items.length > 0) {
			hero = await pb.collection('game_heroes').update(heroes.items[0].id, {
				position,
				lastSeen: new Date().toISOString()
			});
		} else {
			hero = await pb.collection('game_heroes').create({
				user: userId,
				position,
				lastSeen: new Date().toISOString()
			});
		}

		return json({ success: true, hero });
	} catch (err) {
		console.error('[POSITION SYNC] Error:', err);
		throw error(500, 'Failed to sync position');
	}
};
