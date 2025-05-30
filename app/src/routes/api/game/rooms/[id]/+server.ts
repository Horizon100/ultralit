// src/routes/api/game/rooms/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		const room = await locals.pb.collection('game_rooms').getOne(id, {
			expand: 'tables'
		});

		return json({
			success: true,
			data: room
		});
	} catch (error) {
		console.error('Room fetch error:', error);
		return json({ error: 'Failed to fetch room' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const updates = await request.json();

		const room = await locals.pb.collection('game_rooms').update(id, updates);

		return json({
			success: true,
			data: room
		});
	} catch (error) {
		console.error('Room update error:', error);
		return json({ error: 'Failed to update room' }, { status: 500 });
	}
};

