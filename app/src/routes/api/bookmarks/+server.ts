// src/routes/api/bookmarks/+server.ts
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

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const user = locals.user;
    
    if (!user) {
      return json({ 
        success: false, 
        message: 'Authentication required' 
      }, { status: 401 });
    }

    const { messageId, action } = await request.json();
    
    if (!messageId || !['add', 'remove'].includes(action)) {
      return json({ 
        success: false, 
        message: 'Invalid request parameters' 
      }, { status: 400 });
    }

    const currentBookmarks = user.bookmarks || [];
    
    let updatedBookmarks: string[];
    
    if (action === 'add') {
      if (!currentBookmarks.includes(messageId)) {
        updatedBookmarks = [...currentBookmarks, messageId];
      } else {
        updatedBookmarks = currentBookmarks;
      }
    } else {
      updatedBookmarks = currentBookmarks.filter(id => id !== messageId);
    }

    await pb.collection('users').update(user.id, {
      bookmarks: updatedBookmarks
    });

    return json({
      success: true,
      bookmarks: updatedBookmarks,
      message: action === 'add' ? 'Added to bookmarks' : 'Removed from bookmarks'
    });
  } catch (error) {
    console.error('Bookmark API error:', error);
    return json({
      success: false,
      message: 'Failed to update bookmarks'
    }, { status: 500 });
  }
};