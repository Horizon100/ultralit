import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';


export const GET: RequestHandler = async ({ params }) => {
  let postId = params.id;
  
  if (postId.startsWith('repost_')) {
    const parts = postId.split('_');
    if (parts.length >= 3) {
      postId = parts.slice(1, -1).join('_');
    }
  }

  try {
    const post = await pb.collection('posts').getOne(postId, {
      expand: 'user'
    });

    if (!post) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    const user = post.expand?.user;

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const comments = await pb.collection('posts').getList(1, 100, {
      filter: `parent = "${postId}"`,
      sort: 'created',
      expand: 'user'
    });

    return json({
      post: post,
      comments: comments.items,
      user: user
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Post not found';
    return json({ error: errorMessage }, { status: 404 });
  }
};

/**
 * API endpoint for upvoting a post
 * Uses server-side admin authentication to bypass PocketBase permission checks
 */
export const PATCH: RequestHandler = async ({ params, locals }) => {
  try {
    // Check if user is authenticated at all
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;
    const userId = locals.user.id;

    console.log(`Upvoting post ${postId} by user ${userId}`);

    try {
      // Fetch the post using admin API
      const post = await pb.collection('posts').getOne(postId);
      
      // Initialize arrays if they don't exist
      let upvotedBy = post.upvotedBy || [];
      let downvotedBy = post.downvotedBy || [];
      let upvoted = false;
      
      // Toggle upvote
      if (upvotedBy.includes(userId)) {
        // Remove upvote
      upvotedBy = upvotedBy.filter((id: string) => id !== userId);
      } else {
        // Add upvote and remove downvote if exists
        upvotedBy.push(userId);
        upvoted = true;
      downvotedBy = downvotedBy.filter((id: string) => id !== userId);
      }
      
      // Update the post using admin API, bypassing PocketBase permissions
      const updatedPost = await pb.collection('posts').update(postId, {
        upvotedBy,
        downvotedBy,
        upvoteCount: upvotedBy.length,
        downvoteCount: downvotedBy.length
      });
      
      console.log(`Upvote successful for post ${postId}`);
      
      return json({
        success: true,
        upvoted,
        upvoteCount: updatedPost.upvoteCount,
        downvoteCount: updatedPost.downvoteCount,
        upvotedBy: updatedPost.upvotedBy,
        downvotedBy: updatedPost.downvotedBy
      });
    } catch (err) {
      console.error(`Error upvoting post ${postId}:`, err);
      
      if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
        return json({ error: 'Post not found' }, { status: 404 });
      }
      
      throw err;
    }
  } catch (error) {
    console.error('Error in upvote handler:', error);
    return json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Deleting post ${params.id}...`);
    
    try {
      const post = await pb.collection('posts').getOne(params.id);
      
      if (post.user !== locals.user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized to delete this post' }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      try {
        const attachments = await pb.collection('post_attachments').getFullList({
          filter: `post = "${params.id}"`
        });

        for (const attachment of attachments) {
          await pb.collection('post_attachments').delete(attachment.id);
        }
      } catch (attachmentError) {
        console.log('No attachments to delete or attachments collection not found:', attachmentError);
      }

      try {
        const comments = await pb.collection('posts').getFullList({
          filter: `parent = "${params.id}"`
        });

        for (const comment of comments) {
          await pb.collection('posts').delete(comment.id);
        }
      } catch (commentError) {
        console.log('Error deleting comments:', commentError);
      }

      await pb.collection('posts').delete(params.id);

      console.log(`Post ${params.id} deleted successfully`);
      return json({ success: true });
    } catch (err: unknown) {
    console.error(`Error deleting post ${params.id}:`, err);
    
    if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
      return new Response(JSON.stringify({ error: 'Post not found', details: err instanceof Error ? err.message : 'Unknown error' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    throw err;
  }
  } catch (error: unknown) {
    console.error('Error in DELETE post handler:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
