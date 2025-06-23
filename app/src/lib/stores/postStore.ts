import { writable, get } from 'svelte/store';
import type { Post, PostWithInteractions, PostStoreState } from '$lib/types/types.posts';
import { currentUser } from '$lib/pocketbase';
import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';
import { toast } from '$lib/utils/toastUtils';
import { copyToClipboard } from '$lib/utils/clipboardUtils';

interface PostsApiResponse {
	success: boolean;
	posts: PostWithInteractions[];
	totalPages: number;
	totalItems: number;
	filters?: {
		tag?: string;
		tags?: string[];
		parent?: string;
	};
}
interface UpvoteResponse {
	success: boolean;
	upvoted: boolean;
	upvoteCount: number;
	downvoteCount: number;
}

interface RepostResponse {
	success: boolean;
	reposted: boolean;
	repostCount: number;
	repostedBy: string[];
}

function createPostStore() {
	const store = writable<PostStoreState>({
		posts: [],
		loading: false,
		loadingMore: false,
		hasMore: true,
		error: null
	});

	const { subscribe, set, update } = store;

	return {
		subscribe,
		update,

		setLoading: (loading: boolean) => {
			update((state) => ({ ...state, loading }));
		},

		setError: (error: string | null) => {
			update((state) => ({ ...state, error }));
		},

		setPosts: (posts: PostWithInteractions[]) => {
			update((state) => ({ ...state, posts, loading: false }));
		},

		addTagsToPost: async (postId: string, tagIds: string[]) => {
			const result = await clientTryCatch((async () => {
				const user = get(currentUser);
				if (!user?.id) {
					throw new Error('User not authenticated');
				}

				console.log('Adding tags to post:', { postId, tagIds });

				// Update the post with new tags
				const postUpdateResult = await fetchTryCatch<any>(
					`/api/posts/${postId}`,
					{
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							tags: tagIds,
							tagCount: tagIds.length
						}),
						credentials: 'include'
					}
				);

				if (isFailure(postUpdateResult)) {
					throw new Error(`Failed to add tags to post: ${postUpdateResult.error}`);
				}

				const updatedPost = postUpdateResult.data;

				// Update local store
				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === postId
							? {
									...post,
									tags: tagIds,
									tagCount: tagIds.length
								}
							: post
					)
				}));

				// Update tags with the post reference (bidirectional relationship)
				await Promise.all(
					tagIds.map(async (tagId) => {
						const tagResult = await fetchTryCatch<any>(
							`/api/tags/${tagId}/posts`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({ postId }),
								credentials: 'include'
							}
						);

						if (isFailure(tagResult)) {
							console.error(`Failed to update tag ${tagId} with post reference:`, tagResult.error);
						}

						return tagResult;
					})
				);

				console.log('Successfully added tags to post:', postId);
				return updatedPost;
			})(), 'Adding tags to post');

			if (isFailure(result)) {
				throw new Error(result.error);
			}

			return result.data;
		},
		/**
		 * Remove tags from a post and update the bidirectional relationship
		 */
		removeTagsFromPost: async (postId: string, tagIdsToRemove: string[]) => {
			const result = await clientTryCatch((async () => {
				const user = get(currentUser);
				if (!user?.id) {
					throw new Error('User not authenticated');
				}

				// Get current post to find existing tags
				const currentState = get(store);
				const currentPost = currentState.posts.find((p) => p.id === postId);

				if (!currentPost) {
					throw new Error('Post not found in store');
				}

				const currentTags: string[] = currentPost.tags || [];
				const remainingTags = currentTags.filter(
					(tagId: string) => !tagIdsToRemove.includes(tagId)
				);

				console.log('Removing tags from post:', { postId, tagIdsToRemove, remainingTags });

				// Update the post
				const postUpdateResult = await fetchTryCatch<any>(
					`/api/posts/${postId}`,
					{
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							tags: remainingTags,
							tagCount: remainingTags.length
						}),
						credentials: 'include'
					}
				);

				if (isFailure(postUpdateResult)) {
					throw new Error(`Failed to remove tags from post: ${postUpdateResult.error}`);
				}

				const updatedPost = postUpdateResult.data;

				// Update local store
				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === postId
							? {
									...post,
									tags: remainingTags,
									tagCount: remainingTags.length
								}
							: post
					)
				}));

				// Remove post reference from tags (bidirectional relationship)
				await Promise.all(
					tagIdsToRemove.map(async (tagId: string) => {
						const tagResult = await fetchTryCatch<any>(
							`/api/tags/${tagId}/posts/${postId}`,
							{
								method: 'DELETE',
								credentials: 'include'
							}
						);

						if (isFailure(tagResult)) {
							console.error(`Failed to remove post reference from tag ${tagId}:`, tagResult.error);
						}
					})
				);

				console.log('Successfully removed tags from post:', postId);
				return updatedPost;
			})(), `Removing tags from post ${postId}`);

			if (isFailure(result)) {
				console.error('Error removing tags from post:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		/**
		 * Replace all tags on a post (used by auto-tagging)
		 */
		setPostTags: async (postId: string, newTagIds: string[]) => {
			const result = await clientTryCatch((async () => {
				const user = get(currentUser);
				if (!user?.id) {
					throw new Error('User not authenticated');
				}

				console.log('Setting post tags:', { postId, newTagIds });

				// Get current post to find existing tags for cleanup
				const currentState = get(store);
				const currentPost = currentState.posts.find((p) => p.id === postId);
				const currentTags: string[] = currentPost?.tags || [];

				// Update the post with new tags
				const postUpdateResult = await fetchTryCatch<any>(
					`/api/posts/${postId}`,
					{
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							tags: newTagIds,
							tagCount: newTagIds.length
						}),
						credentials: 'include'
					}
				);

				if (isFailure(postUpdateResult)) {
					throw new Error(`Failed to set post tags: ${postUpdateResult.error}`);
				}

				const updatedPost = postUpdateResult.data;

				// Update local store immediately
				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === postId
							? {
									...post,
									tags: newTagIds,
									tagCount: newTagIds.length
								}
							: post
					)
				}));

				const tagsToRemove = currentTags.filter((tagId: string) => !newTagIds.includes(tagId));
				const tagsToAdd = newTagIds.filter((tagId: string) => !currentTags.includes(tagId));

				// Remove old tag relationships
				Promise.all(
					tagsToRemove.map(async (tagId: string) => {
						const removeResult = await fetchTryCatch<any>(
							`/api/tags/${tagId}/posts/${postId}`,
							{
								method: 'DELETE',
								credentials: 'include'
							}
						);

						if (isFailure(removeResult)) {
							console.error(`Failed to remove post reference from tag ${tagId}:`, removeResult.error);
						}
					})
				);

				// Add new tag relationships
				Promise.all(
					tagsToAdd.map(async (tagId: string) => {
						const addResult = await fetchTryCatch<any>(
							`/api/tags/${tagId}/posts`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({ postId }),
								credentials: 'include'
							}
						);

						if (isFailure(addResult)) {
							console.error(`Failed to add post reference to tag ${tagId}:`, addResult.error);
						}
					})
				);

				console.log('Successfully set post tags:', postId);
				return updatedPost;
			})(), `Setting tags for post ${postId}`);

			if (isFailure(result)) {
				console.error('Error setting post tags:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		/**
		 * Fetch posts by tag
		 */
		fetchPostsByTag: async (tagId: string, limit = 20, offset = 0) => {
			const result = await clientTryCatch((async () => {
				console.log('Fetching posts by tag:', { tagId, limit, offset });

				const params = new URLSearchParams({
					tag: tagId,
					limit: limit.toString(),
					offset: offset.toString()
				});

				const fetchResult = await fetchTryCatch<PostsApiResponse>(
					`/api/posts?${params}`,
					{
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to fetch posts by tag: ${fetchResult.error}`);
				}

				const data = fetchResult.data;
				const posts = data.posts || [];

				console.log(`Found ${posts.length} posts for tag ${tagId}`);
				return posts;
			})(), `Fetching posts by tag ${tagId}`);

			if (isFailure(result)) {
				console.error('Error fetching posts by tag:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		/**
		 * Fetch posts by multiple tags (intersection)
		 */
		fetchPostsByTags: async (tagIds: string[], limit = 20, offset = 0) => {
			const result = await clientTryCatch((async () => {
				console.log('Fetching posts by tags:', { tagIds, limit, offset });

				const params = new URLSearchParams({
					tags: tagIds.join(','),
					limit: limit.toString(),
					offset: offset.toString()
				});

				const fetchResult = await fetchTryCatch<any>(
					`/api/posts?${params}`,
					{
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to fetch posts by tags: ${fetchResult.error}`);
				}

				const data = fetchResult.data;
				const posts = data.posts || [];

				console.log(`Found ${posts.length} posts for tags [${tagIds.join(', ')}]`);
				return posts;
			})(), `Fetching posts by tags [${tagIds.join(', ')}]`);

			if (isFailure(result)) {
				console.error('Error fetching posts by tags:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		/**
		 * Get tag statistics for posts
		 */
		getPostTagStats: async () => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<any>(
					'/api/posts/tag-stats',
					{
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to fetch post tag statistics: ${fetchResult.error}`);
				}

				const stats = fetchResult.data;
				return stats;
			})(), 'Fetching post tag statistics');

			if (isFailure(result)) {
				console.error('Error fetching post tag stats:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},


fetchPosts: async (limit = 10, offset = 0, parentId?: string) => {
	const result = await clientTryCatch((async () => {
		console.log('fetchPosts called:', { limit, offset, parentId });

		if (offset === 0) {
			update((state) => ({ ...state, loading: true, error: null }));
		} else {
			update((state) => ({ ...state, loadingMore: true, error: null }));
		}

		const params = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString()
		});

		if (parentId) {
			params.append('parent', parentId);
		}

		const fetchResult = await fetchTryCatch<{success: boolean, data: PostsApiResponse}>(
			`/api/posts?${params}`,
			{
				credentials: 'include'
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to fetch posts: ${fetchResult.error}`);
		}

		// Fix: apiTryCatch wraps response in {success: true, data: yourReturnValue}
		// So posts are at fetchResult.data.data.posts (double nesting)
		const apiResponse = fetchResult.data.data;
		const posts = apiResponse.posts || [];
		const hasMore = posts.length === limit;

		console.log('✅ FIXED - Successfully extracted posts:', posts.length);

		update((state) => ({
			...state,
			posts: offset === 0 ? posts : [...state.posts, ...posts],
			loading: false,
			loadingMore: false,
			hasMore,
			error: null
		}));

		return posts;
	})(), 'Fetching posts');

	if (isFailure(result)) {
		update((state) => ({
			...state,
			error: result.error,
			loading: false,
			loadingMore: false
		}));
		throw new Error(result.error);
	}

	return result.data;
},

loadMorePosts: async (limit = 10) => {
	const currentState = get(store);
	if (currentState.loadingMore || !currentState.hasMore) return;

	const offset = currentState.posts.length;

	const result = await clientTryCatch((async () => {
		console.log('loadMorePosts called:', { limit, offset });

		update((state) => ({ ...state, loadingMore: true, error: null }));

		const params = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString()
		});

		const fetchResult = await fetchTryCatch<{success: boolean, data: PostsApiResponse}>(
			`/api/posts?${params}`,
			{
				credentials: 'include'
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to fetch posts: ${fetchResult.error}`);
		}

		// Same fix: double nesting
		const apiResponse = fetchResult.data.data;
		const posts = apiResponse.posts || [];
		const hasMore = posts.length === limit;

		update((state) => ({
			...state,
			posts: [...state.posts, ...posts],
			loadingMore: false,
			hasMore,
			error: null
		}));

		return posts;
	})(), 'Loading more posts');

	if (isFailure(result)) {
		update((state) => ({
			...state,
			error: result.error,
			loadingMore: false
		}));
		throw new Error(result.error);
	}

	return result.data;
},

addPost: async (content: string, attachments?: File[] | FileList | null, parentId?: string) => {
	const result = await clientTryCatch((async () => {
		const user = get(currentUser);
		if (!user?.id) {
			throw new Error('User not authenticated');
		}

		// Only set loading for main posts, not comments
		if (!parentId) {
			update((state) => ({ ...state, loading: true, error: null }));
		}

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

		// Add attachments if any
		if (filesToUpload.length > 0) {
			filesToUpload.forEach((file, index) => {
				formData.append(`attachment_${index}`, file);
			});
		}

		const fetchResult = await fetchTryCatch<{success: boolean, data: PostWithInteractions}>(
			'/api/posts',
			{
				method: 'POST',
				body: formData,
				credentials: 'include'
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to create post: ${fetchResult.error}`);
		}

		// Fix: Same double nesting issue - POST also uses apiTryCatch
		const newPost = fetchResult.data.data; // Note the double .data

		console.log('✅ FIXED - Post created successfully:', newPost.id);

		// Only update posts list and loading for main posts
		if (!parentId) {
			update((state) => ({
				...state,
				posts: [newPost, ...state.posts],
				loading: false
			}));
		}

		return newPost;
	})(), 'Creating post');

	if (isFailure(result)) {
		// Only update loading state for main posts
		if (!parentId) {
			update((state) => ({ ...state, error: result.error, loading: false }));
		}
		throw new Error(result.error);
	}

	return result.data;
},

		addComment: async (
			parentId: string,
			content: string
			// attachments?: File[] | FileList | null
		) => {
			const result = await clientTryCatch((async () => {
				const user = get(currentUser);
				if (!user?.id) {
					throw new Error('User not authenticated');
				}

				/*
				* Don't set main loading state for comments
				* update((state) => ({ ...state, loading: true, error: null }));
				*/

				const commentData = {
					content,
					user: user.id
				};

				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${parentId}/comments`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(commentData),
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to create comment: ${fetchResult.error}`);
				}

				const result = fetchResult.data;
				const newComment = result.comment;

				// Update the store with the new comment
				update((state) => {
					const parentPostIndex = state.posts.findIndex((post) => post.id === parentId);

					if (parentPostIndex >= 0) {
						const updatedPosts = [...state.posts];
						updatedPosts[parentPostIndex] = {
							...updatedPosts[parentPostIndex],
							commentCount: (updatedPosts[parentPostIndex].commentCount || 0) + 1,
							children: [...(updatedPosts[parentPostIndex].children || []), newComment.id]
						};

						return {
							...state,
							posts: updatedPosts
							// Don't touch loading state
						};
					}

					return state;
				});

				return result;
			})(), 'Creating comment');

			if (isFailure(result)) {
				update((state) => ({ ...state, error: result.error }));
				throw new Error(result.error);
			}

			return result.data;
		},


		fetchChildren: async (postId: string, limit = 20, depth = 1) => {
			const result = await clientTryCatch((async () => {
				const params = new URLSearchParams({
					limit: limit.toString(),
					depth: depth.toString(),
					expand: 'user'
				});

				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${postId}/children?${params}`,
					{
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to fetch children: ${fetchResult.error}`);
				}

				const data = fetchResult.data;
				return data.children || [];
			})(), `Fetching children for post ${postId}`);

			if (isFailure(result)) {
				console.error('Error fetching children:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

sharePost: async (postId: string, username?: string) => {
	const result = await clientTryCatch((async () => {
		const user = get(currentUser);
		
		// Construct the proper URL format
		let postUrl: string;
		if (username) {
			postUrl = `${window.location.origin}/${username}/posts/${postId}`;
		} else {
			// Try to find username from current posts in store
			let currentState: {
				posts: PostWithInteractions[];
				loading: boolean;
				loadingMore: boolean;
				hasMore: boolean;
				error: string | null;
			} | null = null;
			
			const unsubscribe = postStore.subscribe(state => {
				currentState = state;
			});
			unsubscribe();
			
			const postData = currentState?.posts?.find((p: PostWithInteractions) => p.id === postId);
			
			if (postData?.author_username) {
				postUrl = `${window.location.origin}/${postData.author_username}/posts/${postId}`;
			} else {
				// Fallback to simple format
				postUrl = `${window.location.origin}/posts/${postId}`;
			}
		}

		if (user?.id) {
			// User is logged in - update share count in database
			const fetchResult = await fetchTryCatch<{
				success: boolean;
				shareCount: number;
				sharedBy: string[];
				alreadyShared: boolean;
			}>(
				`/api/posts/${postId}/share`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					credentials: 'include'
				}
			);

			if (isFailure(fetchResult)) {
				throw new Error(`Failed to share post: ${fetchResult.error}`);
			}

			const data = fetchResult.data;

			// Update the local store
			update((state) => ({
				...state,
				posts: state.posts.map((post) =>
					post.id === postId
						? {
								...post,
								shareCount: data.shareCount,
								sharedBy: data.sharedBy,
								share: true
							}
						: post
				)
			}));

			// Try to copy to clipboard
			const copyResult = await copyToClipboard(postUrl);
			
			return {
				...data,
				copied: copyResult.success,
				copyMethod: copyResult.method,
				copyError: copyResult.error,
				url: postUrl,
				message: copyResult.success 
					? 'Post shared and link copied to clipboard!' 
					: 'Post shared! Could not copy link automatically.'
			};
		} else {
			// User not logged in - just copy link
			const copyResult = await copyToClipboard(postUrl);
			
			return { 
				success: true, 
				copied: copyResult.success,
				copyMethod: copyResult.method,
				copyError: copyResult.error,
				url: postUrl,
				message: copyResult.success 
					? 'Link copied to clipboard!' 
					: 'Could not copy link automatically.'
			};
		}
	})(), `Sharing post ${postId}`);

	if (isFailure(result)) {
		update((state) => ({ ...state, error: result.error }));
		throw new Error(result.error);
	}

	return result.data;
},
		quotePost: async (quotedPostId: string, content: string, attachments: File[] = []) => {
			const user = get(currentUser);
			if (!user?.id) {
				throw new Error('User not authenticated');
			}

			const result = await clientTryCatch((async () => {

				const formData = new FormData();
				formData.append('content', content);
				formData.append('quotedPostId', quotedPostId);

				attachments.forEach((file, index) => {
					formData.append(`attachment_${index}`, file);
				});

				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${quotedPostId}/quote`,
					{
						method: 'POST',
						body: formData,
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to quote post: ${fetchResult.error}`);
				}

				const data = fetchResult.data;

				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === quotedPostId
							? {
									...post,
									quoteCount: data.quoteCount,
									quotedBy: data.quotedBy,
									quote: true
								}
							: post
					)
				}));

				return data;
			})(), `Quoting post ${quotedPostId}`);

			if (isFailure(result)) {
				update((state) => ({ ...state, error: result.error }));
				throw new Error(result.error);
			}

			return result.data;
		},
toggleUpvote: async (compositePostId: string) => {
  // Extract real post ID
  const realPostId = compositePostId.startsWith('repost_') 
    ? compositePostId.split('_')[1] 
    : compositePostId;
    
  console.log('🎯 Upvoting:', { compositePostId, realPostId });
  
  const result = await clientTryCatch((async () => {
    const fetchResult = await fetchTryCatch<{success: boolean, data: UpvoteResponse}>(
      `/api/posts/${realPostId}/upvote`, // Use real post ID for API
      {
        method: 'PATCH',
        credentials: 'include'
      }
    );

    if (isFailure(fetchResult)) {
      throw new Error(`Failed to toggle upvote: ${fetchResult.error}`);
    }

    const actualResult = fetchResult.data.data;

    update((state) => {
      const newState = {
        ...state,
        posts: state.posts.map((post) => {
          // Update both the original post and any reposts of it
          const shouldUpdate = post.id === realPostId || 
                             (post.isRepost && post.originalPostId === realPostId);
          
          return shouldUpdate
            ? {
                ...post,
                upvote: actualResult.upvoted,
                upvoteCount: actualResult.upvoteCount,
                downvote: actualResult.upvoted ? false : post.downvote,
                downvoteCount: actualResult.downvoteCount || post.downvoteCount
              }
            : post;
        })
      };
      
      return newState;
    });

    return actualResult;
  })(), `Toggling upvote for post ${realPostId}`);

  return result.data;
},

toggleDownvote: async (postId: string) => {
	const result = await clientTryCatch((async () => {
		const fetchResult = await fetchTryCatch<{success: boolean, data: UpvoteResponse}>(
			`/api/posts/${postId}/downvote`,
			{
				method: 'PATCH',
				credentials: 'include'
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to toggle downvote: ${fetchResult.error}`);
		}

		// Fix: Handle double nesting from apiTryCatch
		const result = fetchResult.data.data; // Note the double .data

		update((state) => ({
			...state,
			posts: state.posts.map((post) =>
				post.id === postId
					? {
							...post,
							downvote: result.downvoted !== undefined ? result.downvoted : post.downvote,
							downvoteCount: result.downvoteCount,
							upvote: result.downvoted ? false : post.upvote,
							upvoteCount: result.upvoteCount || post.upvoteCount
						}
					: post
			)
		}));

		return result;
	})(), `Toggling downvote for post ${postId}`);

	if (isFailure(result)) {
		console.error('Error toggling downvote:', result.error);
		throw new Error(result.error);
	}

	return result.data;
},

		markAsRead: async (postId: string) => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${postId}?action=read`,
					{
						method: 'PATCH',
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to mark post as read: ${fetchResult.error}`);
				}

				const result = fetchResult.data;

				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === postId
							? {
									...post,
									hasRead: result.hasRead,
									readCount: result.readCount
								}
							: post
					)
				}));

				return result;
			})(), `Marking post ${postId} as read`);

			if (isFailure(result)) {
				console.error('Error marking post as read:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

toggleRepost: async (postId: string) => {
	const user = get(currentUser);
	if (!user?.id) {
		throw new Error('User not authenticated');
	}

	const result = await clientTryCatch((async () => {
		const fetchResult = await fetchTryCatch<{success: boolean, data: RepostResponse}>(
			`/api/posts/${postId}/repost`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include'
			}
		);

		if (isFailure(fetchResult)) {
			throw new Error(`Failed to toggle repost: ${fetchResult.error}`);
		}

		// Handle the double nesting from apiTryCatch
		const result = fetchResult.data.data;

		update((state) => {
			let updatedPosts = state.posts.map((post) =>
				post.id === postId
					? {
							...post,
							repost: result.reposted,
							repostCount: result.repostCount,
							repostedBy: result.repostedBy
						}
					: post
			);

			// If user reposted, add a repost card to the beginning of the feed
			if (result.reposted) {
				const originalPost = state.posts.find(p => p.id === postId);
				if (originalPost) {
					const repostCard = {
						...originalPost,
						id: `repost_${postId}_${user.id}`,
						isRepost: true,
						originalPostId: postId,
						repostedBy_id: user.id,
						repostedBy_username: user.username,
						repostedBy_name: user.name,
						repostedBy_avatar: user.avatar,
						created: new Date().toISOString(),
						repost: true,
						repostCount: result.repostCount,
						repostedBy: result.repostedBy
					};
					updatedPosts = [repostCard, ...updatedPosts];
				}
			} else {
				// If unreposted, remove the repost card
				updatedPosts = updatedPosts.filter(p => 
					!(p.isRepost && p.originalPostId === postId && p.repostedBy_id === user.id)
				);
			}

			return {
				...state,
				posts: updatedPosts
			};
		});

		return result;
	})(), `Toggling repost for post ${postId}`);

	if (isFailure(result)) {
		update((state) => ({ ...state, error: result.error }));
		throw new Error(result.error);
	}

	return result.data;
},

		updatePost: async (postId: string, data: Partial<Post>) => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${postId}`,
					{
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(data),
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to update post: ${fetchResult.error}`);
				}

				const updatedPost = fetchResult.data;

				update((state) => ({
					...state,
					posts: state.posts.map((post) =>
						post.id === postId ? { ...post, ...updatedPost } : post
					)
				}));

				return updatedPost;
			})(), `Updating post ${postId}`);

			if (isFailure(result)) {
				console.error('Error updating post:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		deletePost: async (postId: string) => {
			const result = await clientTryCatch((async () => {
				const fetchResult = await fetchTryCatch<any>(
					`/api/posts/${postId}`,
					{
						method: 'DELETE',
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to delete post: ${fetchResult.error}`);
				}

				update((state) => ({
					...state,
					posts: state.posts.filter((post) => post.id !== postId)
				}));

				return { success: true };
			})(), `Deleting post ${postId}`);

			if (isFailure(result)) {
				console.error('Error deleting post:', result.error);
				throw new Error(result.error);
			}

			return result.data;
		},

		// Add manual reset function for debugging
		resetLoading: () => {
			update((state) => ({ ...state, loading: false }));
		},

		clear: () => {
			set({
				posts: [],
				loading: false,
				loadingMore: false,
				hasMore: false,
				error: null
			});
		}
	};
}

export const postStore = createPostStore();
