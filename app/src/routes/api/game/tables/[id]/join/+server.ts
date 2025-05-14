// src/routes/api/game/tables/[id]/join/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const { userId } = await request.json();
  
  try {
    const table = await pb.collection('game_tables').getOne(params.id);
    const currentUsers = table.currentUsers || [];
    
    if (currentUsers.length >= table.maxUsers) {
      throw error(400, 'Table is full');
    }
    
    if (!currentUsers.includes(userId)) {
      await pb.collection('game_tables').update(params.id, {
        currentUsers: [...currentUsers, userId]
      });
    }
    
    return json({ success: true });
  } catch (err) {
    throw error(500, 'Failed to join table');
  }
};