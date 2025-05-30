// src/routes/api/game/tables/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const roomId = url.searchParams.get('room');
		const buildingId = url.searchParams.get('building');
		const organizationId = url.searchParams.get('organization');
		
		let filter = 'isActive = true';
		
		if (roomId) {
			filter += ` && room = "${roomId}"`;
		}
		if (buildingId) {
			filter += ` && building = "${buildingId}"`;
		}
		if (organizationId) {
			filter += ` && organization = "${organizationId}"`;
		}

		const tables = await locals.pb.collection('game_tables').getFullList({
			filter,
			sort: 'created'
		});

		return json({
			success: true,
			data: tables
		});
	} catch (error) {
		console.error('Tables fetch error:', error);
		return json({ error: 'Failed to fetch tables' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();

		const table = await locals.pb.collection('game_tables').create({
			name: data.name,
			organization: data.organization,
			building: data.building,
			room: data.room,
			dialog: [],
			position: data.position || { x: 0, y: 0 },
			size: data.size || { width: 1, height: 1 },
			capacity: data.capacity || 4,
			isPublic: data.isPublic || false,
			isActive: true
		});

		// Update room, building, and organization references
		const room = await locals.pb.collection('game_rooms').getOne(data.room);
		const updatedTables = [...(room.tables || []), table.id];
		
		await locals.pb.collection('game_rooms').update(data.room, {
			tables: updatedTables
		});

		const building = await locals.pb.collection('game_buildings').getOne(data.building);
		const updatedBuildingTables = [...(building.tables || []), table.id];
		
		await locals.pb.collection('game_buildings').update(data.building, {
			tables: updatedBuildingTables
		});

		const organization = await locals.pb.collection('game_organizations').getOne(data.organization);
		const updatedOrgTables = [...(organization.tables || []), table.id];
		
		await locals.pb.collection('game_organizations').update(data.organization, {
			tables: updatedOrgTables
		});

		return json({
			success: true,
			data: table
		});
	} catch (error) {
		console.error('Table creation error:', error);
		return json({ error: 'Failed to create table' }, { status: 500 });
	}
};