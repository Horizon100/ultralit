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

    console.log(`Toggling downvote for post ${postId} by user ${userId}`);

    try {
      // Get current post
      const post = await pb.collection('posts').getOne(postId);
      
      let upvotedBy = post.upvotedBy || [];
      let downvotedBy = post.downvotedBy || [];
      let downvoted = false;

      // Toggle downvote
      if (downvotedBy.includes(userId)) {
        // Remove downvote
        downvotedBy = downvotedBy.filter(id => id !== userId);
      } else {
        // Add downvote and remove upvote if exists
        downvotedBy.push(userId);
        downvoted = true;
        upvotedBy = upvotedBy.filter(id => id !== userId);
      }

      // Update post with new arrays and counts
      const updatedPost = await pb.collection('posts').update(postId, {
        upvotedBy,
        downvotedBy,
        upvoteCount: upvotedBy.length,
        downvoteCount: downvotedBy.length
      });

      console.log(`Downvote toggle successful for post ${postId}`);

      return json({
        success: true,
        downvoted,
        upvoteCount: updatedPost.upvoteCount,
        downvoteCount: updatedPost.downvoteCount
      });
    } catch (err) {
      console.error(`Error toggling downvote for post ${postId}:`, err);
      
      if (err.status === 404) {
        return new Response(JSON.stringify({ error: 'Post not found' }), { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      throw err;
    }
  } catch (error) {
    console.error('Error in downvote handler:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};