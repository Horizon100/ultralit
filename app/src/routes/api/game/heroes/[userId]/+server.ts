import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { userId } = params;
		
		const heroes = await locals.pb.collection('game_heroes').getFullList({
			filter: `user = "${userId}"`,
			expand: 'user'
		});

		if (heroes.length === 0) {
			return json({ error: 'Hero not found' }, { status: 404 });
		}

		return json({
			success: true,
			data: heroes[0]
		});
	} catch (error) {
		console.error('Hero fetch error:', error);
		return json({ error: 'Failed to fetch hero' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { userId } = params;
		const updates = await request.json();

		const heroes = await locals.pb.collection('game_heroes').getFullList({
			filter: `user = "${userId}"`
		});

		if (heroes.length === 0) {
			return json({ error: 'Hero not found' }, { status: 404 });
		}

		const hero = heroes[0];

		const updatedHero = await locals.pb.collection('game_heroes').update(hero.id, {
			...updates,
			lastSeen: new Date().toISOString()
		});

		const heroWithUser = await locals.pb.collection('game_heroes').getOne(updatedHero.id, {
			expand: 'user'
		});

		return json({
			success: true,
			data: heroWithUser
		});
	} catch (error) {
		console.error('Hero update error:', error);
		return json({ error: 'Failed to update hero' }, { status: 500 });
	}
};