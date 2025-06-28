import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const { userId } = params;

			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${userId}"`,
				expand: 'user'
			});

			if (heroes.length === 0) {
				throw new Error('Hero not found');
			}

			return {
				success: true,
				data: heroes[0]
			};
		},
		'Failed to fetch hero',
		500
	);
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const { userId } = params;
			const updates = await request.json();

			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user = "${userId}"`
			});

			if (heroes.length === 0) {
				throw new Error('Hero not found');
			}

			const hero = heroes[0];

			const updatedHero = await locals.pb.collection('game_heroes').update(hero.id, {
				...updates,
				lastSeen: new Date().toISOString()
			});

			const heroWithUser = await locals.pb.collection('game_heroes').getOne(updatedHero.id, {
				expand: 'user'
			});

			return {
				success: true,
				data: heroWithUser
			};
		},
		'Failed to update hero',
		500
	);
};
