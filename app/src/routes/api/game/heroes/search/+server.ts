import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const query = url.searchParams.get('q');
		if (!query || query.trim().length < 2) {
			return json({ error: 'Query must be at least 2 characters' }, { status: 400 });
		}

		console.log('[HEROES_SEARCH] Searching for:', query);

		// Search heroes by user name, username, or email
		const heroes = await locals.pb.collection('game_heroes').getFullList({
			filter: `user.name ~ "${query}" || user.username ~ "${query}" || user.email ~ "${query}"`,
			expand: 'user',
			sort: 'user.name'
		});

		console.log('[HEROES_SEARCH] Found heroes:', heroes.length);

		return json({
			success: true,
			data: heroes
		});
	} catch (error) {
		console.error('Heroes search error:', error);
		return json({ error: 'Failed to search heroes' }, { status: 500 });
	}
};