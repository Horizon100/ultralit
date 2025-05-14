// src/routes/api/game/roads/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  try {
    const roads = await pb.collection('game_roads').getFullList({
      expand: 'from,to'
    });
    
    return json({ roads });
  } catch (err) {
    throw error(500, 'Failed to load roads');
  }
};