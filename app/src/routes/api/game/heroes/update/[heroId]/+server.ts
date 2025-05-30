import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const heroId = params.heroId;
		const updateData = await request.json();
		
		console.log('[API] Updating hero:', heroId, 'with data:', updateData);

		// Update the hero directly by hero ID
		const updatedHero = await locals.pb.collection('game_heroes').update(heroId, updateData);
		
		console.log('[API] Hero updated successfully');

		return json({
			success: true,
			data: updatedHero
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return json({ 
			error: 'Failed to update hero', 
			details: errorMessage,
		}, { status: 500 });
	}
};