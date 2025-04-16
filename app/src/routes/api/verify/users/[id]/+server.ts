// src/routes/api/verify/users/[id]/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  // Verify ownership
  if (!locals.user?.id || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  try {
    const user = await pb.collection('users').getOne(params.id, {
      expand: 'verification'  // If you have related data
    });

    return json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        description: user.description,
        role: user.role,
        created: user.created,
        updated: user.updated,
        verified: user.verified,
        verification_status: user.expand?.verification?.status,
        // Add other critical fields
        last_verified: user.expand?.verification?.updated
      }
    });
  } catch (err) {
    throw error(400, 'Failed to fetch verification data');
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user?.id || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  const data = await request.json();
  
  try {
    const updated = await pb.collection('users').update(params.id, {
      ...data,
      updated: new Date().toISOString()  // Force update timestamp
    });

    return json({
      success: true,
      user: {
        id: updated.id,
        verified: updated.verified,
        updated: updated.updated
      }
    });
  } catch (err) {
    throw error(400, 'Update failed');
  }
};