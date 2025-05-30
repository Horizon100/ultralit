// src/routes/api/game/tables/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		const table = await locals.pb.collection('game_tables').getOne(id);

		return json({
			success: true,
			data: table
		});
	} catch (error) {
		console.error('Table fetch error:', error);
		return json({ error: 'Failed to fetch table' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const updates = await request.json();

		const table = await locals.pb.collection('game_tables').update(id, updates);

		return json({
			success: true,
			data: table
		});
	} catch (error) {
		console.error('Table update error:', error);
		return json({ error: 'Failed to update table' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		
		// Get table to find parent references
		const table = await locals.pb.collection('game_tables').getOne(id);
		
		// Mark as inactive instead of deleting
		await locals.pb.collection('game_tables').update(id, {
			isActive: false
		});

		// Remove from parent references
		const room = await locals.pb.collection('game_rooms').getOne(table.room);
		const updatedRoomTables = (room.tables || []).filter((t: string) => t !== id);
		
		await locals.pb.collection('game_rooms').update(table.room, {
			tables: updatedRoomTables
		});

		const building = await locals.pb.collection('game_buildings').getOne(table.building);
		const updatedBuildingTables = (building.tables || []).filter((t: string) => t !== id);
		
		await locals.pb.collection('game_buildings').update(table.building, {
			tables: updatedBuildingTables
		});

		const organization = await locals.pb.collection('game_organizations').getOne(table.organization);
		const updatedOrgTables = (organization.tables || []).filter((t: string) => t !== id);
		
		await locals.pb.collection('game_organizations').update(table.organization, {
			tables: updatedOrgTables
		});

		return json({
			success: true,
			message: 'Table deactivated successfully'
		});
	} catch (error) {
		console.error('Table deletion error:', error);
		return json({ error: 'Failed to delete table' }, { status: 500 });
	}
};