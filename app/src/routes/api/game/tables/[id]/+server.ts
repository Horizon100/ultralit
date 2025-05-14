// src/routes/api/game/tables/[id]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  try {
    const table = await pb.collection('game_tables').getOne(params.id, {
      expand: 'currentUsers,currentThread,project,room'
    });
    
    return json({ table });
  } catch (err) {
    throw error(404, 'Table not found');
  }
};