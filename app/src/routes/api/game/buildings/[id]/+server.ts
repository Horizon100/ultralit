
// src/routes/api/game/buildings/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		const building = await locals.pb.collection('game_buildings').getOne(id, {
			expand: 'rooms,tables'
		});

		return json({
			success: true,
			data: building
		});
	} catch (error) {
		console.error('Building fetch error:', error);
		return json({ error: 'Failed to fetch building' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const updates = await request.json();

		const building = await locals.pb.collection('game_buildings').update(id, updates);

		return json({
			success: true,
			data: building
		});
	} catch (error) {
		console.error('Building update error:', error);
		return json({ error: 'Failed to update building' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		// Get building to find organization
		const building = await locals.pb.collection('game_buildings').getOne(id);
		
		// Mark as inactive instead of deleting
		await locals.pb.collection('game_buildings').update(id, {
			isActive: false
		});

		// Remove from organization
		const organization = await locals.pb.collection('game_organizations').getOne(building.organization);
		const updatedBuildings = (organization.buildings || []).filter((b: string) => b !== id);
		
		await locals.pb.collection('game_organizations').update(building.organization, {
			buildings: updatedBuildings
		});

		return json({
			success: true,
			message: 'Building deactivated successfully'
		});
	} catch (error) {
		console.error('Building deletion error:', error);
		return json({ error: 'Failed to delete building' }, { status: 500 });
	}
};