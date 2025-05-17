import { writable, get } from 'svelte/store';
import type { Post, PostWithInteractions } from '$lib/types/types.posts';
import { currentUser } from '$lib/pocketbase';

function createPostStore() {
  const store = writable<{
    posts: PostWithInteractions[];
    loading: boolean;
    error: string | null;
  }>({
    posts: [],
    loading: false,
    error: null
  });

  const { subscribe, set, update } = store;

  return {
    subscribe,

    setLoading: (loading: boolean) => {
      update(state => ({ ...state, loading }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },

    setPosts: (posts: PostWithInteractions[]) => {
      update(state => ({ ...state, posts, loading: false }));
    },

// Updated addPost function for proper attachment handling
addPost: async (content: string, attachments?: File[] | FileList | null, parentId?: string) => {
  try {
    const user = get(currentUser);
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    update(state => ({ ...state, loading: true, error: null }));

    const formData = new FormData();
    formData.append('content', content);
    formData.append('user', user.id);
    
    // Add parent ID if this is a comment
    if (parentId) {
      formData.append('parent', parentId);
    }

    // Normalize attachments to always be an array
    let filesToUpload: File[] = [];
    if (attachments) {
      if (attachments instanceof FileList) {
        filesToUpload = Array.from(attachments);
      } else if (Array.isArray(attachments)) {
        filesToUpload = attachments;
      }
    }

    // Add attachments if any - match the server-side naming convention with attachment_ prefix
    if (filesToUpload.length > 0) {
      filesToUpload.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
    }

    const response = await fetch('/api/posts', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create post');
    }

    const newPost = await response.json();

    if (!parentId) {
      update(state => ({
        ...state,
        posts: [newPost, ...state.posts],
        loading: false
      }));
    } else {
      update(state => ({ ...state, loading: false }));
    }

    return newPost;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
    update(state => ({ ...state, error: errorMessage, loading: false }));
    throw error;
  }
},

// Updated addComment function for proper handling
addComment: async (parentId: string, content: string, attachments?: File[] | FileList | null) => {
  try {
    const user = get(currentUser);
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    update(state => ({ ...state, loading: true, error: null }));

    // When adding a comment through the comment API endpoint
    const commentData = {
      content,
      user: user.id
    };

    const response = await fetch(`/api/posts/${parentId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentData),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create comment');
    }

    const result = await response.json();
    const newComment = result.comment;

    // Update the store with the new comment if we're already showing comments for this post
    update(state => {
      // Find the parent post in our current state
      const parentPostIndex = state.posts.findIndex(post => post.id === parentId);
      
      // If we have the parent post in the state
      if (parentPostIndex >= 0) {
        const updatedPosts = [...state.posts];
        // Update the parent post with new comment count
        updatedPosts[parentPostIndex] = {
          ...updatedPosts[parentPostIndex],
          commentCount: (updatedPosts[parentPostIndex].commentCount || 0) + 1,
          children: [
            ...(updatedPosts[parentPostIndex].children || []),
            newComment.id
          ]
        };
        
        return {
          ...state,
          posts: updatedPosts,
          loading: false
        };
      }
      
      return { ...state, loading: false };
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create comment';
    update(state => ({ ...state, error: errorMessage, loading: false }));
    throw error;
  }
},
    fetchPosts: async (limit = 20, offset = 0, parentId?: string) => {
      try {
        update(state => ({ ...state, loading: true, error: null }));

        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString()
        });

        // Add parent parameter if fetching children
        if (parentId) {
          params.append('parent', parentId);
        }

        const response = await fetch(`/api/posts?${params}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }

        const data = await response.json();
        const posts = data.posts || [];

        update(state => ({
          ...state,
          posts: offset === 0 ? posts : [...state.posts, ...posts],
          loading: false
        }));

        return posts;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch posts';
        update(state => ({ ...state, error: errorMessage, loading: false }));
        throw error;
      }
    },

    fetchChildren: async (postId: string, limit = 20, depth = 1) => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          depth: depth.toString()
        });

        const response = await fetch(`/api/posts/${postId}/children?${params}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch children');
        }

        const data = await response.json();
        return data.children || [];
      } catch (error) {
        console.error('Error fetching children:', error);
        throw error;
      }
    },

sharePost: async (postId: string) => {
    const user = get(currentUser);
    if (!user?.id) {
        throw new Error('User not authenticated');
    }

    try {
        update(state => ({ ...state, loading: true, error: null }));

        const response = await fetch(`/api/posts/${postId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to share post');
        }

        const data = await response.json();

        // Update the local store
        update(state => ({
            ...state,
            posts: state.posts.map(post => 
                post.id === postId 
                    ? { 
                        ...post, 
                        shareCount: data.shareCount,
                        sharedBy: data.sharedBy,
                        share: true 
                    }
                    : post
            ),
            loading: false
        }));

        return data;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to share post';
        update(state => ({ ...state, error: errorMessage, loading: false }));
        throw error;
    }
},
quotePost: async (quotedPostId: string, content: string, attachments: File[] = []) => {
    const user = get(currentUser);
    if (!user?.id) {
        throw new Error('User not authenticated');
    }

    try {
        update(state => ({ ...state, loading: true, error: null }));

        const formData = new FormData();
        formData.append('content', content);
        formData.append('quotedPostId', quotedPostId);
        
        attachments.forEach((file, index) => {
            formData.append(`attachment_${index}`, file);
        });

        const response = await fetch(`/api/posts/${quotedPostId}/quote`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to quote post');
        }

        const data = await response.json();

        update(state => ({
            ...state,
            posts: state.posts.map(post => 
                post.id === quotedPostId 
                    ? { 
                        ...post, 
                        quoteCount: data.quoteCount,
                        quotedBy: data.quotedBy,
                        quote: true 
                    }
                    : post
            ),
            loading: false
        }));

        return data;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to quote post';
        update(state => ({ ...state, error: errorMessage, loading: false }));
        throw error;
    }
},
    toggleUpvote: async (postId: string) => {
      try {
        const response = await fetch(`/api/posts/${postId}/upvote`, {
          method: 'PATCH',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to toggle upvote');
        }

        const result = await response.json();

        update(state => ({
          ...state,
          posts: state.posts.map(post =>
            post.id === postId ? { 
              ...post, 
              upvote: result.upvoted,
              upvoteCount: result.upvoteCount,
              // Remove from downvotes if was downvoted
              downvote: result.upvoted ? false : post.downvote,
              downvoteCount: result.downvoteCount || post.downvoteCount
            } : post
          )
        }));

        return result;
      } catch (error) {
        console.error('Error toggling upvote:', error);
        throw error;
      }
    },

toggleDownvote: async (postId: string) => {
  try {
    const response = await fetch(`/api/posts/${postId}/downvote`, {
      method: 'PATCH',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to toggle downvote');
    }

    const result = await response.json();

    update(state => ({
      ...state,
      posts: state.posts.map(post =>
        post.id === postId ? { 
          ...post, 
          // Update to match server response property names
          downvote: result.downvoted !== undefined ? result.downvoted : post.downvote,
          downvoteCount: result.downvoteCount,
          // Remove from upvotes if was downvoted
          upvote: result.downvoted ? false : post.upvote,
          upvoteCount: result.upvoteCount || post.upvoteCount
        } : post
      )
    }));

    return result;
  } catch (error) {
    console.error('Error toggling downvote:', error);
    throw error;
  }
},

    markAsRead: async (postId: string) => {
      try {
        const response = await fetch(`/api/posts/${postId}/read`, {
          method: 'PATCH',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to mark post as read');
        }

        const result = await response.json();

        update(state => ({
          ...state,
          posts: state.posts.map(post =>
            post.id === postId ? { 
              ...post, 
              hasRead: result.hasRead,
              readCount: result.readCount
            } : post
          )
        }));

        return result;
      } catch (error) {
        console.error('Error marking post as read:', error);
        throw error;
      }
    },

toggleRepost: async (postId: string) => {
    const user = get(currentUser);
    if (!user?.id) {
        throw new Error('User not authenticated');
    }

    try {
        update(state => ({ ...state, loading: true, error: null }));

        const response = await fetch(`/api/posts/${postId}/repost`, {
            method: 'POST', // Changed from PATCH to POST
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to toggle repost');
        }

        const data = await response.json();

        // Update the local store
        update(state => ({
            ...state,
            posts: state.posts.map(post => 
                post.id === postId 
                    ? { 
                        ...post, 
                        repost: data.reposted,
                        repostCount: data.repostCount,
                        repostedBy: data.repostedBy 
                    }
                    : post
            ),
            loading: false
        }));

        return data;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to toggle repost';
        update(state => ({ ...state, error: errorMessage, loading: false }));
        throw error;
    }
},

    updatePost: async (postId: string, data: Partial<Post>) => {
      try {
        const response = await fetch(`/api/posts/${postId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to update post');
        }

        const updatedPost = await response.json();

        update(state => ({
          ...state,
          posts: state.posts.map(post =>
            post.id === postId ? { ...post, ...updatedPost } : post
          )
        }));

        return updatedPost;
      } catch (error) {
        console.error('Error updating post:', error);
        throw error;
      }
    },

    deletePost: async (postId: string) => {
      try {
        const response = await fetch(`/api/posts/${postId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to delete post');
        }

        update(state => ({
          ...state,
          posts: state.posts.filter(post => post.id !== postId)
        }));
      } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
      }
    },

    clear: () => {
      set({
        posts: [],
        loading: false,
        error: null
      });
    }
  };
}

export const postStore = createPostStore();