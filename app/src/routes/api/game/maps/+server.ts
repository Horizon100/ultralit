// src/routes/api/game/maps/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// src/routes/api/game/maps/+server.ts
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	const project = url.searchParams.get('project');
	console.log('[MAPS API] Requested project:', project);
	
	// Only filter by project if one is specified
	const filter = project ? `project = "${project}"` : '';
	console.log('[MAPS API] Filter:', filter);

	try {
		const maps = await pb.collection('game_maps').getFullList({
			filter,
			expand: 'game_rooms,project'
		});

		console.log('[MAPS API] Found maps count:', maps.length);
		console.log('[MAPS API] Maps:', maps.map(m => ({ id: m.id, name: m.name, project: m.project })));

		return json({ maps });
	} catch (err) {
		console.error('[MAPS API] Error:', err);
		throw error(500, 'Failed to load maps');
	}
};