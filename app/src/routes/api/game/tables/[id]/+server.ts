// src/routes/api/game/tables/[id]/+server.ts
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			throw new Error('Unauthorized');
		}

		const { id } = params;

		const table = await locals.pb.collection('game_tables').getOne(id);

		return table;
	}, 'Failed to fetch table', 401);

export const PATCH: RequestHandler = async ({ locals, params, request }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const updates = await request.json();

		const table = await locals.pb.collection('game_tables').update(id, updates);

		return table;
	}, 'Failed to update table', 401);

export const DELETE: RequestHandler = async ({ locals, params }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			throw new Error('Unauthorized');
		}

		const { id } = params;

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

		return { message: 'Table deactivated successfully' };
	}, 'Failed to delete table', 401);