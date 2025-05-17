import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    // Check authentication
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const postId = params.id;
    if (!postId) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const limit = parseInt(url.searchParams.get('limit') || '20');
    const depth = parseInt(url.searchParams.get('depth') || '1');

    console.log(`Fetching children for post ${postId} with depth ${depth}`);

    // Get post to verify it exists
    await pb.collection('posts').getOne(postId);

    // Define a recursive function to fetch children
    async function fetchChildrenRecursive(parentId: string, currentDepth: number) {
      if (currentDepth > depth) return [];

      // Fetch direct children
      const childrenResult = await pb.collection('posts').getList(1, limit, {
        filter: `parent = "${parentId}"`,
        sort: '-created'
      });

      // Get unique user IDs
      const userIds = [...new Set(childrenResult.items.map((child: any) => child.user))];

      // Batch fetch user data
      const usersMap = new Map();
      if (userIds.length > 0) {
        const usersResult = await pb.collection('users').getList(1, userIds.length, {
          filter: userIds.map(id => `id = "${id}"`).join(' || '),
          fields: 'id,username,name,avatar'
        });
        
        usersResult.items.forEach((user: any) => {
          usersMap.set(user.id, user);
        });
      }

      // Process each child
      const children = await Promise.all(
        childrenResult.items.map(async (child: any) => {
          const userData = usersMap.get(child.user);
          
          // Check if user has interacted with this post
          const upvote = child.upvotedBy?.includes(locals.user!.id) || false;
          const downvote = child.downvotedBy?.includes(locals.user!.id) || false;
          const repost = child.repostedBy?.includes(locals.user!.id) || false;
          const hasRead = child.readBy?.includes(locals.user!.id) || false;

          // Recursively fetch child's children if needed
          let subChildren = [];
          if (currentDepth < depth && (child.children?.length > 0 || child.commentCount > 0)) {
            subChildren = await fetchChildrenRecursive(child.id, currentDepth + 1);
          }

          return {
            ...child,
            upvote,
            downvote,
            repost,
            hasRead,
            author_name: userData?.name,
            author_username: userData?.username,
            author_avatar: userData?.avatar,
            children: subChildren
          };
        })
      );

      return children;
    }

    // Start the recursive fetch
    const children = await fetchChildrenRecursive(postId, 1);

    return json({
      success: true,
      children
    });
  } catch (error: any) {
    console.error('Error fetching post children:', error);
    
    if (error.status === 404) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};