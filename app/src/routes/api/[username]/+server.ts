import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params }) => {
  const { username } = params;

  try {
    // Find user by username
    const users = await pb.collection('users').getList(1, 1, {
      filter: `username = "${username}"`
    });

    if (users.items.length === 0) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const user = users.items[0];
    console.log('=== USER PROFILE DEBUG ===');
    console.log('User ID:', user.id);
    console.log('Username:', user.username);

    // Get user's original posts and reposts separately
    const [originalPosts, repostedPosts] = await Promise.all([
      // Original posts by the user
      pb.collection('posts').getList(1, 50, {
        filter: `user = "${user.id}"`,
        sort: '-created',
        expand: 'user'
      }),
      
      // Posts reposted by the user (including own posts they reposted)
      pb.collection('posts').getList(1, 50, {
        filter: `repostedBy ~ "${user.id}"`,
        sort: '-created', 
        expand: 'user'
      })
    ]);

    console.log('Original posts:', originalPosts.totalItems);
    console.log('Reposted posts:', repostedPosts.totalItems);

    // Create a combined array with proper flags
    let allPosts = [];

    // Add original posts (but check if they were also reposted by the user)
    originalPosts.items.forEach(post => {
      const isOwnRepost = post.repostedBy && post.repostedBy.includes(user.id);
      allPosts.push({
        ...post,
        isRepost: false,
        isOwnRepost: isOwnRepost,
        // For original posts, set reposter info if they reposted their own post
        ...(isOwnRepost && {
          repostedBy_id: user.id,
          repostedBy_username: user.username,
          repostedBy_name: user.name,
          repostedBy_avatar: user.avatar
        })
      });

      // If user reposted their own post, add a separate repost entry
      if (isOwnRepost) {
        allPosts.push({
          ...post,
          id: `repost_${post.id}_${user.id}`, // Create unique ID for repost
          isRepost: true,
          originalPostId: post.id,
          repostedBy_id: user.id,
          repostedBy_username: user.username,
          repostedBy_name: user.name,
          repostedBy_avatar: user.avatar
        });
      }
    });

    // Add reposts of other people's posts
    repostedPosts.items.forEach(post => {
      // Only add if it's not the user's own post (already handled above)
      if (post.user !== user.id) {
        allPosts.push({
          ...post,
          id: `repost_${post.id}_${user.id}`, // Create unique ID for repost
          isRepost: true,
          originalPostId: post.id,
          repostedBy_id: user.id,
          repostedBy_username: user.username,
          repostedBy_name: user.name,
          repostedBy_avatar: user.avatar
        });
      }
    });

    allPosts.forEach(post => {
      if (post.expand?.user) {
        post.author_name = post.expand.user.name;
        post.author_username = post.expand.user.username;
        post.author_avatar = post.expand.user.avatar;
      }
    });

    // Sort by created date (this line should already exist)
    allPosts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    console.log('Combined posts:', allPosts.length);
    console.log('Reposts in combined:', allPosts.filter(p => p.isRepost).length);

    // Get user profile if exists
    let profile = null;
    try {
      const profileResult = await pb.collection('user_profiles').getList(1, 1, {
        filter: `user = "${user.id}"`
      });
      profile = profileResult.items[0] || null;
    } catch (err) {
      console.log('No profile found for user');
    }

    return json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        created: user.created,
        updated: user.updated
      },
      profile,
      posts: allPosts,
      totalPosts: allPosts.length
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return json({ error: 'Failed to fetch user' }, { status: 500 });
  }
};