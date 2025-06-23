// src/routes/api/game/rooms/[id]/+server.ts
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const room = await locals.pb.collection('game_rooms').getOne(id, {
			expand: 'tables'
		});

		return room;
	}, 'Failed to fetch room', 401);

export const PATCH: RequestHandler = async ({ locals, params, request }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const updates = await request.json();

		const room = await locals.pb.collection('game_rooms').update(id, updates);

		return room;
	}, 'Failed to update room', 401);
