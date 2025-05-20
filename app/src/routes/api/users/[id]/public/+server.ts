// src/routes/api/users/[id]/public/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { User } from '$lib/types/types';

export const GET: RequestHandler = async ({ params, locals }) => {
  // Ensure the requester is authenticated
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = params.id;
  
  try {
    // Request the user record
    const user = await pb.collection('users').getOne(userId);
    
    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }
    
    // Build public profile with only the specified fields
    const publicProfile = {
      id: user.id,
      username: user.username,
      name: user.name || '',
      avatar: user.avatar,
      verified: user.verified,
      description: user.description || '',
      role: user.role,
      last_login: user.last_login,
      perks: user.activated_features || [], // I'm assuming perks maps to activated_features
      taskAssignments: user.taskAssignments || [],
      userTaskStatus: user.userTaskStatus || {
        backlog: 0,
        todo: 0,
        focus: 0,
        done: 0,
        hold: 0,
        postpone: 0,
        cancel: 0,
        review: 0,
        delegate: 0,
        archive: 0
      },
      userProjects: user.projects || [], // I'm using 'projects' field as userProjects
      hero: user.hero || '',
      created: user.created
    };
    
    return json(publicProfile);
  } catch (error) {
    console.error('Error fetching public user profile:', error);
    return json({ error: 'User not found' }, { status: 404 });
  }
};