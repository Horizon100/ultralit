// src/routes/api/game/rooms/+server.ts
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const buildingId = url.searchParams.get('building');
			const organizationId = url.searchParams.get('organization');

			let filter = 'isActive = true';

			if (buildingId) {
				filter += ` && building = "${buildingId}"`;
			}
			if (organizationId) {
				filter += ` && organization = "${organizationId}"`;
			}

			const rooms = await locals.pb.collection('game_rooms').getFullList({
				filter,
				sort: 'created',
				expand: 'tables'
			});

			return rooms;
		},
		'Failed to fetch rooms',
		500
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	return apiTryCatch(
		async () => {
			if (!locals.pb.authStore.isValid) {
				throw new Error('Unauthorized');
			}

			const data = await request.json();

			// Get current user ID
			const userId = locals.pb.authStore.model?.id;
			if (!userId) {
				throw new Error('User ID not found');
			}

			// Validate required fields
			if (!data.name || !data.organization || !data.building) {
				throw new Error('Missing required fields: name, organization, building');
			}

			// Validate building exists
			let building;
			try {
				building = await locals.pb.collection('game_buildings').getOne(data.building);
			} catch {
				throw new Error('Building not found');
			}

			// Validate organization exists
			let organization;
			try {
				organization = await locals.pb.collection('game_organizations').getOne(data.organization);
			} catch {
				throw new Error('Organization not found');
			}

			const room = await locals.pb.collection('game_rooms').create({
				name: data.name,
				description: data.description || '',
				organization: data.organization,
				building: data.building,
				position: data.position || { x: 0, y: 0 },
				size: data.size || { width: 3, height: 3 },
				isPublic: data.isPublic || false,
				isActive: true,
				capacity: data.capacity || 10,
				activeMembers: [],
				createdBy: userId
			});

			// Update building to include this room
			const updatedRooms = [...(building.rooms || []), room.id];
			await locals.pb.collection('game_buildings').update(data.building, {
				rooms: updatedRooms
			});

			// Update organization to include this room
			const updatedOrgRooms = [...(organization.rooms || []), room.id];
			await locals.pb.collection('game_organizations').update(data.organization, {
				rooms: updatedOrgRooms
			});

			return room;
		},
		'Failed to create room',
		500
	);
};
