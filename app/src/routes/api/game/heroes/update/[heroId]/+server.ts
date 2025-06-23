import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const heroId = params.heroId;
			const updateData = await request.json();

			console.log('[API] Updating hero:', heroId, 'with data:', updateData);

			// Update the hero directly by hero ID
			const updatedHero = await locals.pb.collection('game_heroes').update(heroId, updateData);

			console.log('[API] Hero updated successfully');

			return updatedHero;
		},
		'Failed to update hero',
		500
	);
};