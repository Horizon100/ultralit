// src/routes/api/game/buildings/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	console.log('Buildings GET route hit');
	
	if (!locals.pb.authStore.isValid) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const organizationId = url.searchParams.get('organization');
		let filter = 'isActive = true';
		
		if (organizationId) {
			filter += ` && organization = "${organizationId}"`;
		}

		const buildings = await locals.pb.collection('game_buildings').getFullList({
			filter,
			sort: 'created'
		});

		console.log('Buildings fetched:', buildings.length);

		return json({
			success: true,
			data: buildings
		});
	} catch (error) {
		console.error('Buildings fetch error:', error);
		return json({ error: 'Failed to fetch buildings' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	console.log('Buildings POST route hit');
	
	if (!locals.pb.authStore.isValid) {
		console.log('Unauthorized access attempt');
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();
		console.log('Received building data:', JSON.stringify(data, null, 2));

		// Get current user ID
		const userId = locals.pb.authStore.model?.id;
		if (!userId) {
			console.log('No user ID found in auth store');
			return json({ error: 'User ID not found' }, { status: 401 });
		}
		console.log('User ID:', userId);

		// Validate required fields
		if (!data.name || !data.organization) {
			console.log('Missing required fields:', { name: !!data.name, organization: !!data.organization });
			return json({ error: 'Missing required fields: name, organization' }, { status: 400 });
		}

		// Validate organization exists
		let organization;
		try {
			organization = await locals.pb.collection('game_organizations').getOne(data.organization);
			console.log('Organization found:', organization.name);
		} catch (orgError) {
			console.error('Organization not found:', data.organization, orgError);
			return json({ error: 'Organization not found' }, { status: 404 });
		}

		// Create building data - only include fields that exist in your schema
		const buildingData = {
			name: data.name,
			description: data.description,
			organization: data.organization,
			position: data.position,
			size: data.size,
			buildingType: data.buildingType,
			isActive: true,
			isPublic: true,
			createdBy: userId
		};

		// Add optional fields only if they exist in your schema
		if (data.description) buildingData.description = data.description;
		if (data.position) buildingData.position = data.position;
		if (data.size) buildingData.size = data.size;
		if (data.buildingType) buildingData.buildingType = data.buildingType;
		if (typeof data.isPublic === 'boolean') buildingData.isPublic = data.isPublic;

		console.log('Final building data to create:', JSON.stringify(buildingData, null, 2));

		const building = await locals.pb.collection('game_buildings').create(buildingData);
		console.log('Building created successfully:', building.id);

		// Update organization to include this building (only if buildings field exists)
		try {
			const updatedBuildings = [...(organization.buildings || []), building.id];
			await locals.pb.collection('game_organizations').update(data.organization, {
				buildings: updatedBuildings
			});
			console.log('Organization updated successfully');
		} catch (orgUpdateError) {
			console.error('Failed to update organization (might not have buildings field):', orgUpdateError);
			// Don't fail the whole request for this
		}

		return json({
			success: true,
			data: building
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorObj = error as unknown;
		
		const errorStatus = (errorObj && typeof errorObj === 'object' && 'status' in errorObj) 
			? (errorObj as { status: unknown }).status 
			: undefined;
		const errorData = (errorObj && typeof errorObj === 'object' && 'data' in errorObj) 
			? (errorObj as { data: unknown }).data 
			: undefined;
		const errorResponse = (errorObj && typeof errorObj === 'object' && 'response' in errorObj) 
			? (errorObj as { response: unknown }).response 
			: undefined;
		
		console.error('Building creation error details:', {
			message: errorMessage,
			status: errorStatus,
			data: errorData,
			response: errorResponse
		});
		
		return json({
			error: 'Failed to create building',
			details: errorMessage,
			pbError: errorData
		}, { status: 500 });
	}
};