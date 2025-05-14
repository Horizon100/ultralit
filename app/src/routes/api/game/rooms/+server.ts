// src/routes/api/game/rooms/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const project = url.searchParams.get('project');
  const filter = project ? `mapContainer.project = "${project}"` : '';

  try {
    const rooms = await pb.collection('game_rooms').getList(1, 50, { 
      filter,
      expand: 'mapContainer'
    });
    
    return json({ rooms: rooms.items });
  } catch (err) {
    throw error(500, 'Failed to load rooms');
  }
};