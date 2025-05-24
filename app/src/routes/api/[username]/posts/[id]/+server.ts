import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params }) => {
  const { username, id } = params;

  // Check if id is provided
  if (!id) {
    return json({ error: 'Post ID is required' }, { status: 400 });
  }

  try {
    // First verify the user exists and get their ID
    const users = await pb.collection('users').getList(1, 1, {
      filter: `username = "${username}"`
    });

    if (users.items.length === 0) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const user = users.items[0];

    // Get the specific post
    const post = await pb.collection('posts').getOne(id, {
      expand: 'user'
    });

    // Verify the post belongs to this user
    if (post.user !== user.id) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    // Get comments for this post
    const comments = await pb.collection('posts').getList(1, 100, {
      filter: `parent = "${id}"`,
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
    return json({ error: 'Post not found' }, { status: 404 });
  }
};