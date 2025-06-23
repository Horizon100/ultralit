// src/routes/api/users/[id]/public/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { User } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) {
      throw new Error('Unauthorized');
    }

    const userId = params.id;

    const userResult = await pbTryCatch(pb.collection('users').getOne(userId), 'fetch user');
    const user = unwrap(userResult);

    const publicProfile = {
      id: user.id,
      username: user.username,
      name: user.name || '',
      avatar: user.avatar,
      verified: user.verified,
      description: user.description || '',
      role: user.role,
      last_login: user.last_login,
      perks: user.activated_features || [],
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
      userProjects: user.projects || [],
      hero: user.hero || '',
      created: user.created
    };

    return json({ success: true, data: publicProfile });
  }, 'Failed to fetch public user profile');
