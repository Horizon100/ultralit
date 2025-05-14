// src/routes/api/game/rooms/[id]/join/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const { userId } = await request.json();
  
  try {
    const room = await pb.collection('game_rooms').getOne(params.id);
    const currentUsers = room.currentUsers || [];
    
    if (!currentUsers.includes(userId)) {
      await pb.collection('game_rooms').update(params.id, {
        currentUsers: [...currentUsers, userId]
      });
    }
    
    return json({ success: true });
  } catch (err) {
    throw error(500, 'Failed to join room');
  }
};