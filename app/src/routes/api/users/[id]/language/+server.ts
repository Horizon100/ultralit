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
      language: user.language_preference || 'en'
    });
  } catch (err) {
    throw error(400, err.message);
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  const { language } = await request.json();
  try {
    const updated = await pb.collection('users').update(params.id, {
      language_preference: language
    });
    return json({ 
      success: true,
      language: updated.language_preference
    });
  } catch (err) {
    throw error(400, err.message);
  }
};