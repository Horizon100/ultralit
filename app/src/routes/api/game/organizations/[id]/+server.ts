// src/routes/api/game/organizations/[id]/+server.ts
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals, params }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const { id } = params;

			const organization = await locals.pb.collection('game_organizations').getOne(id, {
				expand: 'buildings,rooms,tables'
			});

			return organization;
		},
		'Failed to fetch organization',
		500
	);
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			const updates = await request.json();

			const organization = await locals.pb.collection('game_organizations').update(id, updates);

			return organization;
		},
		'Failed to update organization',
		500
	);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const { id } = params;

			// Mark as inactive instead of deleting
			await locals.pb.collection('game_organizations').update(id, {
				isActive: false
			});

			return { message: 'Organization deactivated successfully' };
		},
		'Failed to delete organization',
		500
	);
};
