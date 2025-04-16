import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  // Check authorization
  if (!locals.user || params.id !== locals.user.id) {
    throw error(403, 'Forbidden');
  }

  try {
    const userId = params.id;
    
    // Get thread count
    const threadsResponse = await pb.collection('threads').getList(1, 1, {
      filter: `creator.id="${userId}"`,
      sort: '-created'
    });
    const threadCount = threadsResponse.totalItems;
    
    // Get message count
    const messagesResponse = await pb.collection('messages').getList(1, 1, {
      filter: `user.id="${userId}"`,
      sort: '-created'
    });
    const messageCount = messagesResponse.totalItems;
    
    // Get tag count - adjust the collection name if different
    const tagsResponse = await pb.collection('tags').getList(1, 1, {
      filter: `creator.id="${userId}"`,
      sort: '-created'
    });
    const tagCount = tagsResponse.totalItems;
    
    // Get timer count - adjust the collection name if different
    const timersResponse = await pb.collection('timers').getList(1, 1, {
      filter: `user.id="${userId}"`,
      sort: '-created'
    });
    const timerCount = timersResponse.totalItems;
    
    // Get user for last active time
    const user = await pb.collection('users').getOne(userId);
    const lastActive = user.updated || user.lastActive || user.created;
    
    return json({
      success: true,
      threadCount,
      messageCount,
      tagCount,
      timerCount,
      lastActive
    });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    throw error(400, err.message);
  }
};