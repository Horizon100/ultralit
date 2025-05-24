import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

// GET comments for a post
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const postId = params.id;
    const limit = parseInt(url.searchParams.get('limit') || '20');

    console.log(`Fetching comments for post ${postId}`);

    try {
      // Fetch comments with user expansion
      const commentsResult = await pb.collection('posts').getList(1, limit, {
        filter: `parent = "${postId}"`,
        sort: '-created',
        expand: 'user',
        fields: '*,expand.user.id,expand.user.username,expand.user.name,expand.user.avatar'
      });

      const comments = commentsResult.items.map(comment => ({
        ...comment,
        author_name: comment.expand?.user?.name,
        author_username: comment.expand?.user?.username,
        author_avatar: comment.expand?.user?.avatar
      }));

      return json({
        success: true,
        comments,
        totalPages: commentsResult.totalPages,
        totalItems: commentsResult.totalItems
      });
    } catch (err: unknown) {
      console.error(`Error fetching comments for post ${postId}:`, err);
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  } catch (err: unknown) {
    console.error('Error in GET comment handler:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};

// POST new comment
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const postId = params.id;
    const data = await request.json();

    if (!data.content || !data.content.trim()) {
      return new Response(JSON.stringify({ error: 'Comment content is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Creating comment for post ${postId}`);

    try {
      // Create the comment with proper parent field
      const comment = await pb.collection('posts').create({
        content: data.content.trim(),
        user: locals.user.id,
        parent: postId
      });

      // Get the parent post to update its children array
      const parentPost = await pb.collection('posts').getOne(postId);
      const children = parentPost.children || [];
      if (!children.includes(comment.id)) {
        children.push(comment.id);
      }

      // Update parent post with comment info
      const commentedBy = parentPost.commentedBy || [];
      if (!commentedBy.includes(locals.user.id)) {
        commentedBy.push(locals.user.id);
      }

      await pb.collection('posts').update(postId, {
        children,
        commentedBy,
        commentCount: (parentPost.commentCount || 0) + 1
      });

      // Fetch the comment with user data
      const commentWithUser = await pb.collection('posts').getOne(comment.id, {
        expand: 'user',
        fields: '*,expand.user.id,expand.user.username,expand.user.name,expand.user.avatar'
      });

      const result = {
        ...commentWithUser,
        author_name: commentWithUser.expand?.user?.name,
        author_username: commentWithUser.expand?.user?.username,
        author_avatar: commentWithUser.expand?.user?.avatar
      };

      return json({ success: true, comment: result });
    } catch (err) {
      console.error(`Error creating comment for post ${postId}:`, err);
      throw err;
    }
  } catch (err: unknown) {
    console.error('Error in POST comment handler:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};