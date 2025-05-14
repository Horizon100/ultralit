// src/routes/api/game/maps/[id]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  try {
    const map = await pb.collection('game_maps').getOne(params.id, {
      expand: 'game_rooms,project'
    });
    
    return json({ map });
  } catch (err) {
    throw error(404, 'Map not found');
  }
};