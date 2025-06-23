// src/routes/api/posts/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { PostAttachment, Post } from '$lib/types/types.posts';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

// Add this as a temporary test endpoint
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const postId = params.id;
    console.log('Testing post ID:', postId);
    
    // Test 1: Check if post exists at all
    const posts = await pb.collection('posts').getList(1, 1, {
      filter: `id = "${postId}"`
    });
    
    console.log('Posts found:', posts.items.length);
    
    if (posts.items.length === 0) {
      return json({ 
        error: 'Post not found in database',
        postId,
        totalPosts: await pb.collection('posts').getList(1, 1).then(r => r.totalItems)
      });
    }
    
    // Test 2: Try to get the post without expansion
    const post = await pb.collection('posts').getOne(postId);
    console.log('Post retrieved:', { id: post.id, user: post.user });
    
    // Test 3: Try to get the user separately
    const user = await pb.collection('users').getOne(post.user);
    console.log('User retrieved:', { id: user.id, username: user.username });

    // Get post attachments
    const postAttachments = await pb.collection('posts_attachments').getFullList({
      filter: `post = "${postId}"`
    });
    console.log('Post attachments found:', postAttachments.length);

    // Get comments (posts with this post as parent)
    const comments = await pb.collection('posts').getList(1, 100, {
      filter: `parent = "${postId}"`,
      sort: 'created'
    });
    console.log('Comments found:', comments.items.length);

    // Get users for comments
    const commentUserIds = [...new Set(comments.items.map(c => c.user))];
    const commentUsers = new Map();
    
    for (const userId of commentUserIds) {
      try {
        const commentUser = await pb.collection('users').getOne(userId);
        commentUsers.set(userId, commentUser);
      } catch (error) {
        console.error('Error fetching comment user:', userId, error);
      }
    }

    // Get comment attachments
    const commentIds = comments.items.map((c) => c.id);
    const commentAttachmentsMap = new Map();

    if (commentIds.length > 0) {
      const commentAttachments = await pb.collection('posts_attachments').getFullList({
        filter: commentIds.map((id) => `post = "${id}"`).join(' || ')
      });

      for (const attachment of commentAttachments) {
        if (!commentAttachmentsMap.has(attachment.post)) {
          commentAttachmentsMap.set(attachment.post, []);
        }
        commentAttachmentsMap.get(attachment.post).push(attachment);
      }
    }

    // Check user interactions if authenticated
    const isAuthenticated = !!locals.user;
    const userId = locals.user?.id;

    // Transform comments with all required data
    const transformedComments = comments.items.map((comment) => {
      const commentUser = commentUsers.get(comment.user);
      const upvotedBy = comment.upvotedBy || [];
      const downvotedBy = comment.downvotedBy || [];
      const repostedBy = comment.repostedBy || [];
      const readBy = comment.readBy || [];
      const sharedBy = comment.sharedBy || [];
      const quotedBy = comment.quotedBy || [];

      return {
        ...comment,
        // Add expand object for PostCard fallback
        expand: commentUser ? { user: commentUser } : undefined,
        // Set author fields that PostCard expects
        author_name: commentUser?.name,
        author_username: commentUser?.username,
        author_avatar: commentUser?.avatar,
        // Include attachments
        attachments: commentAttachmentsMap.get(comment.id) || [],
        // User interaction states
        upvote: isAuthenticated && userId ? upvotedBy.includes(userId) : false,
        downvote: isAuthenticated && userId ? downvotedBy.includes(userId) : false,
        repost: isAuthenticated && userId ? repostedBy.includes(userId) : false,
        hasRead: isAuthenticated && userId ? readBy.includes(userId) : false,
        share: isAuthenticated && userId ? sharedBy.includes(userId) : false,
        quote: isAuthenticated && userId ? quotedBy.includes(userId) : false,
        preview: false,
        // Interaction counts
    upvoteCount: post.upvoteCount ?? upvotedBy.length ?? 0,
    downvoteCount: post.downvoteCount ?? downvotedBy.length ?? 0,
        repostCount: comment.repostCount || repostedBy.length,
        shareCount: comment.shareCount || sharedBy.length,
        quoteCount: comment.quoteCount || quotedBy.length,
        commentCount: comment.commentCount || 0,
        readCount: comment.readCount || readBy.filter((id: string) => id !== comment.user).length
      };
    });

    // Transform main post with all required data
    const upvotedBy = post.upvotedBy || [];
    const downvotedBy = post.downvotedBy || [];
    const repostedBy = post.repostedBy || [];
    const readBy = post.readBy || [];
    const sharedBy = post.sharedBy || [];
    const quotedBy = post.quotedBy || [];

    const transformedPost = {
      ...post,
      // Add expand object for PostCard fallback
      expand: { user },
      // Set author fields that PostCard expects  
      author_name: user.name,
      author_username: user.username,
      author_avatar: user.avatar,
      // Include attachments
      attachments: postAttachments,
      // User interaction states
      upvote: isAuthenticated && userId ? upvotedBy.includes(userId) : false,
      downvote: isAuthenticated && userId ? downvotedBy.includes(userId) : false,
      repost: isAuthenticated && userId ? repostedBy.includes(userId) : false,
      hasRead: isAuthenticated && userId ? readBy.includes(userId) : false,
      share: isAuthenticated && userId ? sharedBy.includes(userId) : false,
      quote: isAuthenticated && userId ? quotedBy.includes(userId) : false,
      preview: false,
      // Interaction counts
      upvoteCount: post.upvoteCount || upvotedBy.length,
      downvoteCount: post.downvoteCount || downvotedBy.length,
      repostCount: post.repostCount || repostedBy.length,
      shareCount: post.shareCount || sharedBy.length,
      quoteCount: post.quoteCount || quotedBy.length,
      commentCount: post.commentCount || comments.items.length,
      readCount: post.readCount || readBy.filter((id: string) => id !== post.user).length,
      // Add tags if they exist
      tags: post.tags || [],
      tagCount: post.tagCount || 0
    };

    console.log('✅ Successfully enhanced post data:', {
      postId: transformedPost.id,
      authorName: transformedPost.author_name,
      authorUsername: transformedPost.author_username,
      hasAvatar: !!transformedPost.author_avatar,
      attachmentsCount: transformedPost.attachments.length,
      commentsCount: transformedComments.length
    });
    
    return json({ 
      post: transformedPost,
      comments: transformedComments,
      user
    });
    
  } catch (error: unknown) {
    console.error('Test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return json({ 
      error: errorMessage,
      stack: errorStack
    }, { status: 500 });
  }
};
// Update your PATCH handler in src/routes/api/posts/[id]/+server.ts

export const PATCH: RequestHandler = async ({ params, locals, url, request }) =>
  apiTryCatch(async () => {
    if (!locals.user) throw new Error('Unauthorized');
    
    const postId = params.id;
    const userId = locals.user.id;
    const action = url.searchParams.get('action');

    const post = unwrap(await pbTryCatch(pb.collection('posts').getOne<Post>(postId), 'get post'));

    // Handle different actions
    if (action === 'read') {
      const readBy = post.readBy || [];
      let hasRead = readBy.includes(userId);

      if (post.user !== userId && !hasRead) {
        readBy.push(userId);
        hasRead = true;

        const readCountExcludingAuthor = readBy.filter((id) => id !== post.user).length;
        const updatedPost = unwrap(await pbTryCatch(
          pb.collection('posts').update(postId, {
            readBy,
            readCount: readCountExcludingAuthor
          }),
          'update read state'
        ));

        return json({
          success: true,
          hasRead,
          readCount: updatedPost.readCount
        });
      } else {
        const currentReadCount = readBy.filter((id) => id !== post.user).length;
        return json({
          success: true,
          hasRead: post.user !== userId ? hasRead : false,
          readCount: currentReadCount
        });
      }
    }

    // Handle tag updates (for auto-tagging)
    if (action === 'update-tags' || !action) {
      try {
        const requestData = await request.json();
        
        // Check if this is a tag update request
        if (requestData.tags !== undefined) {
          console.log('Updating post tags:', { postId, tags: requestData.tags });

          // Verify user has permission to modify this post
          if (post.user !== userId) {
            throw new Error('Unauthorized to modify this post');
          }

          if (!Array.isArray(requestData.tags)) {
            throw new Error('Tags must be an array');
          }

          // Update the post with new tags
          const updatedPost = unwrap(await pbTryCatch(
            pb.collection('posts').update(postId, {
              tags: requestData.tags,
              tagCount: requestData.tags.length
            }),
            'update post tags'
          ));

          console.log('Successfully updated post tags:', postId);

          return json({
            success: true,
            data: updatedPost
          });
        }
      } catch (jsonError) {
        // If JSON parsing fails, fall through to vote handling
        console.log('No JSON body found, treating as vote request');
      }
    }

    // Handle upvote action (default behavior)
    let upvotedBy = post.upvotedBy || [];
    let downvotedBy = post.downvotedBy || [];
    let upvoted = false;

    if (upvotedBy.includes(userId)) {
      // Remove upvote
      upvotedBy = upvotedBy.filter((id) => id !== userId);
    } else {
      // Add upvote and remove any downvote
      upvotedBy.push(userId);
      upvoted = true;
      downvotedBy = downvotedBy.filter((id) => id !== userId);
    }

    const updatedPost = unwrap(await pbTryCatch(
      pb.collection('posts').update(postId, {
        upvotedBy,
        downvotedBy,
        upvoteCount: upvotedBy.length,
        downvoteCount: downvotedBy.length
      }),
      'update vote state'
    ));

    return json({
      success: true,
      upvoted,
      upvoteCount: updatedPost.upvoteCount,
      downvoteCount: updatedPost.downvoteCount,
      upvotedBy: updatedPost.upvotedBy,
      downvotedBy: updatedPost.downvotedBy
    });
  }, 'Failed to update post');
export const DELETE: RequestHandler = async ({ params, locals }) =>
  apiTryCatch(async () => {
    if (!locals.user) throw new Error('Unauthorized');

    const post = unwrap(await pbTryCatch(pb.collection('posts').getOne<Post>(params.id), 'get post'));

    if (post.user !== locals.user.id) {
      throw new Error('Unauthorized to delete this post');
    }

    // Delete attachments
    const attachments = await pb.collection('posts_attachments').getFullList<PostAttachment>({
      filter: `post = "${params.id}"`
    });
    for (const attachment of attachments) {
      await pbTryCatch(pb.collection('posts_attachments').delete(attachment.id), 'delete attachment');
    }

    // Delete comments
    const comments = await pb.collection('posts').getFullList<Post>({
      filter: `parent = "${params.id}"`
    });
    for (const comment of comments) {
      await pbTryCatch(pb.collection('posts').delete(comment.id), 'delete comment');
    }

    // Delete the post
    await pbTryCatch(pb.collection('posts').delete(params.id), 'delete post');

    return json({ success: true });
  }, 'Failed to delete post');