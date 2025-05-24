import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  try {
    const project = await pb.collection('projects').getOne(params.id);
    
    // Verify access
    if (project.owner !== locals.user.id && 
        !project.collaborators?.includes(locals.user.id)) {
      throw error(403, 'Forbidden');
    }
    
    if (!project.collaborators || project.collaborators.length === 0) {
      return json({ success: true, data: [] });
    }
    
    const collaborators = await pb.collection('users').getFullList({
      filter: project.collaborators.map((id: string) => `id = "${id}"`).join(' || ')
    });
    
    return json({ success: true, data: collaborators });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load collaborators';
    throw error(400, errorMessage);
  }
};
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  
  const { userId } = await request.json();
  try {
    const project = await pb.collection('projects').getOne(params.id);
    
    // Verify ownership
    if (project.owner !== locals.user.id) {
      throw error(403, 'Only project owner can add collaborators');
    }
    
    const updated = await pb.collection('projects').update(params.id, {
      collaborators: [...new Set([...project.collaborators, userId])]
    });
    
    return json({ success: true, data: updated });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to add collaborators';
    throw error(400, errorMessage);
  }
};