// src/routes/api/game/heroes/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	const excludeUserId = url.searchParams.get('exclude');

	try {
		let filter = '';
		if (excludeUserId) {
			filter = `user != "${excludeUserId}"`;
		}

		const heroes = await pb.collection('game_heroes').getFullList({
			filter,
			expand: 'user'
		});

		return json({ heroes });
	} catch (err) {
		throw error(500, 'Failed to load heroes');
	}
};
