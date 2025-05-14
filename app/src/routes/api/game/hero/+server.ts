// src/routes/api/game/hero/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.pb.authStore.isValid) {
    throw error(401, 'Unauthorized');
  }

  const { user, position,currentProject, currentMap, currentRoom, currentTable, isMoving } = await request.json();
  
  try {
    const hero = await pb.collection('game_heroes').create({
      user,
      position,
      currentMap,
      currentProject,
      currentRoom,
      currentTable,
      isMoving,
      lastSeen: new Date().toISOString()
    }, { expand: 'user' });
    
    return json({ hero });
  } catch (err) {
    throw error(500, 'Failed to create hero');
  }
};