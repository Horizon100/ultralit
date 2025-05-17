import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const PATCH: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const postId = params.id;
    const userId = locals.user.id;

    console.log(`Marking post ${postId} as read by user ${userId}`);

    try {
      // Get current post
      const post = await pb.collection('posts').getOne(postId);
      
      let readBy = post.readBy || [];
      let hasRead = false;

      // Add user to readBy if not already present
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        hasRead = true;

        // Update post with new readBy array and count
        const updatedPost = await pb.collection('posts').update(postId, {
          readBy,
          readCount: readBy.length
        });

        console.log(`Post ${postId} marked as read successfully`);

        return json({
          success: true,
          hasRead,
          readCount: updatedPost.readCount
        });
      } else {
        // Already read
        return json({
          success: true,
          hasRead: true,
          readCount: post.readCount
        });
      }
    } catch (err) {
      console.error(`Error marking post ${postId} as read:`, err);
      
      if (err.status === 404) {
        return new Response(JSON.stringify({ error: 'Post not found' }), { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      throw err;
    }
  } catch (error) {
    console.error('Error in read handler:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};