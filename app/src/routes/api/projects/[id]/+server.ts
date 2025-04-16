// src/routes/api/projects/[id]/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  try {
    const project = await pb.collection('projects').getOne(params.id, {
      expand: 'owner,collaborators'
    });
    
    // Verify access
    if (project.owner !== locals.user.id && 
        !project.collaborators?.includes(locals.user.id)) {
      throw error(403, 'Forbidden');
    }
    
    return json({ success: true, data: project });
  } catch (err) {
    throw error(400, err.message);
  }
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  const data = await request.json();
  try {
    const project = await pb.collection('projects').getOne(params.id);
    
    // Verify ownership
    if (project.owner !== locals.user.id) {
      throw error(403, 'Only project owner can update');
    }
    
    const updated = await pb.collection('projects').update(params.id, data);
    return json({ success: true, data: updated });
  } catch (err) {
    throw error(400, err.message);
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  try {
    const project = await pb.collection('projects').getOne(params.id);
    
    // Verify ownership
    if (project.owner !== locals.user.id) {
      throw error(403, 'Only project owner can delete');
    }
    
    await pb.collection('projects').delete(params.id);
    return json({ success: true });
  } catch (err) {
    throw error(400, err.message);
  }
};