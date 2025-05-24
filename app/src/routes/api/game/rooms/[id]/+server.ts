// src/routes/api/game/rooms/[id]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	try {
		const room = await pb.collection('game_rooms').getOne(params.id, {
			expand: 'mapContainer,game_tables,currentUsers'
		});

		return json({ room });
	} catch (err) {
		throw error(404, 'Room not found');
	}
};
