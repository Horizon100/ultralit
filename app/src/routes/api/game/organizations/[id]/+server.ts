// src/routes/api/game/organizations/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		const organization = await locals.pb.collection('game_organizations').getOne(id, {
			expand: 'buildings,rooms,tables'
		});

		return json({
			success: true,
			data: organization
		});
	} catch (error) {
		console.error('Organization fetch error:', error);
		return json({ error: 'Failed to fetch organization' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const updates = await request.json();

		const organization = await locals.pb.collection('game_organizations').update(id, updates);

		return json({
			success: true,
			data: organization
		});
	} catch (error) {
		console.error('Organization update error:', error);
		return json({ error: 'Failed to update organization' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		// Mark as inactive instead of deleting
		await locals.pb.collection('game_organizations').update(id, {
			isActive: false
		});

		return json({
			success: true,
			message: 'Organization deactivated successfully'
		});
	} catch (error) {
		console.error('Organization deletion error:', error);
		return json({ error: 'Failed to delete organization' }, { status: 500 });
	}
};