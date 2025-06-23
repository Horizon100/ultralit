// src/routes/api/game/buildings/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals, url }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const organizationId = url.searchParams.get('organization');
		let filter = 'isActive = true';

		if (organizationId) {
			filter += ` && organization = "${organizationId}"`;
		}

		const buildings = await locals.pb.collection('game_buildings').getFullList({
			filter,
			sort: 'created'
		});

		return {
			success: true,
			data: buildings
		};
	}, 'Failed to fetch buildings', 500);

export const POST: RequestHandler = async ({ locals, request }) =>
	apiTryCatch(async () => {
		if (!locals.pb.authStore.isValid) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const data = await request.json();

		const userId = locals.pb.authStore.model?.id;
		if (!userId) {
			return json({ error: 'User ID not found' }, { status: 401 });
		}

		if (!data.name || !data.organization) {
			return json({ error: 'Missing required fields: name, organization' }, { status: 400 });
		}

		const organization = await locals.pb.collection('game_organizations').getOne(data.organization);

		const buildingData = {
			name: data.name,
			description: data.description,
			organization: data.organization,
			position: data.position,
			size: data.size,
			buildingType: data.buildingType,
			isActive: true,
			isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : true,
			createdBy: userId
		};

		const building = await locals.pb.collection('game_buildings').create(buildingData);

		try {
			const updatedBuildings = [...(organization.buildings || []), building.id];
			await locals.pb.collection('game_organizations').update(data.organization, {
				buildings: updatedBuildings
			});
		} catch {
			// Do not fail the request if organization update fails
		}

		return {
			success: true,
			data: building
		};
	}, 'Failed to create building', 500);