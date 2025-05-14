// src/routes/api/game/maps/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const project = url.searchParams.get('project');
  const filter = project ? `project = "${project}"` : '';

  try {
    const maps = await pb.collection('game_maps').getFullList({
      filter,
      expand: 'game_rooms,project'
    });
    
    return json({ maps });
  } catch (err) {
    throw error(500, 'Failed to load maps');
  }
};