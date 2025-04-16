import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user?.bookmarks?.length) {
      return json([]);
    }

    const records = await pb.collection('messages').getList(1, 50, {
      filter: user.bookmarks.map(id => `id = '${id}'`).join(' || '),
      sort: '-created',
      expand: 'user,thread'
    });

    const messages = records.items.map(message => ({
      id: message.id,
      text: message.text,
      type: message.type,
      created: message.created,
      thread: message.thread,
      threadName: message.expand?.thread?.name || 'Unknown Thread',
      attachments: message.attachments
    }));

    return json(messages);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return json([], { status: 500 });
  }
};