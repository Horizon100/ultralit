import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals, url }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const query = url.searchParams.get('q');
			if (!query || query.trim().length < 2) {
				throw new Error('Query must be at least 2 characters');
			}

			console.log('[HEROES_SEARCH] Searching for:', query);

			// Search heroes by user name, username, or email
			const heroes = await locals.pb.collection('game_heroes').getFullList({
				filter: `user.name ~ "${query}" || user.username ~ "${query}" || user.email ~ "${query}"`,
				expand: 'user',
				sort: 'user.name'
			});

			console.log('[HEROES_SEARCH] Found heroes:', heroes.length);

			return {
				success: true,
				data: heroes
			};
		},
		'Failed to search heroes',
		500
	);
};