import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  try {
    const user = await pb.collection('users').getOne(params.id);
    return json({ 
      success: true, 
      theme: user.theme_preference || 'default'
    });
  } catch (err) {
    throw error(400, err.message);
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  const { theme } = await request.json();
  try {
    const updated = await pb.collection('users').update(params.id, {
      theme_preference: theme
    });
    return json({ 
      success: true,
      theme: updated.theme_preference
    });
  } catch (err) {
    throw error(400, err.message);
  }
};