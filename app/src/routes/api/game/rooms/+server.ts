// src/routes/api/game/rooms/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
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

		return json({
			success: true,
			data: rooms
		});
	} catch (error) {
		console.error('Rooms fetch error:', error);
		return json({ error: 'Failed to fetch rooms' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();
		console.log('Creating room with data:', data);

		// Get current user ID
		const userId = locals.pb.authStore.model?.id;
		if (!userId) {
			return json({ error: 'User ID not found' }, { status: 401 });
		}

		// Validate required fields
		if (!data.name || !data.organization || !data.building) {
			return json({ error: 'Missing required fields: name, organization, building' }, { status: 400 });
		}

		// Validate building exists
		let building;
		try {
			building = await locals.pb.collection('game_buildings').getOne(data.building);
		} catch (buildingError) {
			return json({ error: 'Building not found' }, { status: 404 });
		}

		// Validate organization exists
		let organization;
		try {
			organization = await locals.pb.collection('game_organizations').getOne(data.organization);
		} catch (orgError) {
			return json({ error: 'Organization not found' }, { status: 404 });
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

		console.log('Room created successfully:', room.id);

		return json({
			success: true,
			data: room
		});
		} catch (createError) {
			const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
			
			console.error('Room creation error:', {
				message: errorMessage,
				error: createError
			});
			
			return json({ 
				error: 'Failed to create room',
				details: errorMessage
			}, { status: 500 });
		}
			
};