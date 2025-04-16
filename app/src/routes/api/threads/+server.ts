//api/threads/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals }) => {
    console.log('Threads endpoint hit');
    if (!locals.user) {
      console.warn('Unauthorized access attempt');
      throw error(401, 'Unauthorized');
    }
    
    try {
      const threads = await pb.collection('threads').getFullList({
        filter: `user = "${locals.user.id}"`,
        expand: 'user,participants'
      });
      console.log(`Found ${threads.length} threads for user ${locals.user.id}`);
      return json({ success: true, data: threads });
    } catch (err) {
      console.error('Endpoint error:', err);
      throw error(400, err instanceof Error ? err.message : 'Failed to fetch threads');
    }
  };