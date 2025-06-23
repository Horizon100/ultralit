// src/routes/api/game/tables/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals, url }) =>
  apiTryCatch(async () => {
    if (!locals.pb.authStore.isValid) {
      throw new Error('Unauthorized');
    }

    const roomId = url.searchParams.get('room');
    const buildingId = url.searchParams.get('building');
    const organizationId = url.searchParams.get('organization');

    let filter = 'isActive = true';
    if (roomId) filter += ` && room = "${roomId}"`;
    if (buildingId) filter += ` && building = "${buildingId}"`;
    if (organizationId) filter += ` && organization = "${organizationId}"`;

    const tables = await locals.pb.collection('game_tables').getFullList({
      filter,
      sort: 'created'
    });

    return json({ success: true, data: tables });
  }, 'Failed to fetch tables');

export const POST: RequestHandler = async ({ locals, request }) =>
  apiTryCatch(async () => {
    if (!locals.pb.authStore.isValid) {
      throw new Error('Unauthorized');
    }

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

    const room = await locals.pb.collection('game_rooms').getOne(data.room);
    await locals.pb.collection('game_rooms').update(data.room, {
      tables: [...(room.tables || []), table.id]
    });

    const building = await locals.pb.collection('game_buildings').getOne(data.building);
    await locals.pb.collection('game_buildings').update(data.building, {
      tables: [...(building.tables || []), table.id]
    });

    const organization = await locals.pb.collection('game_organizations').getOne(data.organization);
    await locals.pb.collection('game_organizations').update(data.organization, {
      tables: [...(organization.tables || []), table.id]
    });

    return json({ success: true, data: table });
  }, 'Failed to create table');
