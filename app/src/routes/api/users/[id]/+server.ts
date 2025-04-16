// src/routes/api/users/[id]/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';

// GET /api/users/[id]
export async function GET({ params, locals }) {
  if (!locals.user) throw error(401);
  
  try {
    const record = await pb.collection('users').getOne(params.id);
    
    // Return public data only if requesting another user's profile
    if (params.id !== locals.user.id) {
      return json({
        id: record.id,
        username: record.username,
        name: record.name,
        avatar: record.avatar
      });
    }
    return json(record);
  } catch (err) {
    throw error(404, 'User not found');
  }
}

// PATCH /api/users/[id]
export async function PATCH({ params, request, locals }) {
  if (!locals.user || params.id !== locals.user.id) throw error(403);
  
  const data = await request.json();
  try {
    const record = await pb.collection('users').update(params.id, data);
    return json(record);
  } catch (err) {
    throw error(400, err.message);
  }
}