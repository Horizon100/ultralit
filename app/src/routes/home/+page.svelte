<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { showSidenav, showInput, showRightSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { fade } from 'svelte/transition';
	import type { User, UserProfile, Threads, Messages } from '$lib/types/types'; // Removed PublicUserProfile
	import { postStore } from '$lib/stores/postStore';
	import type { PostWithInteractions, PostStoreState} from '$lib/types/types.posts';
	// Removed: import { getPublicUserProfile, getPublicUserProfiles } from '$lib/clients/profileClient';
	import { pocketbaseUrl, getPublicUserData, currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import PostComposer from '$lib/features/posts/components/PostComposer.svelte';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import PostCommentModal from '$lib/features/posts/components/PostCommentModal.svelte';
	import RepostCard from '$lib/features/posts/components/RepostCard.svelte';
	import PostQuoteCard from '$lib/features/posts/components/PostQuoteCard.svelte';
	import PostSidenav from '$lib/features/posts/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/posts/components/PostTrends.svelte';
	import AiMenu from '$lib/features/agents/components/AiMenu.svelte';
	import { threadsStore, ThreadSortOption, showThreadList } from '$lib/stores/threadsStore';
	import { slide, fly } from 'svelte/transition';
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import {
		processPostTaggingAsync,
		shouldGenerateTags
	} from '$lib/features/posts/utils/postTagging';
	import { defaultModel } from '$lib/features/ai/utils/models';
	import type { AIModel } from '$lib/types/types';
	import { get } from 'svelte/store';
	import { toast } from '$lib/utils/toastUtils';
	import { 
		clientTryCatch, 
		validationTryCatch,
		isSuccess, 
		isFailure,
		type Result
	} from '$lib/utils/errorUtils';
	import { InfiniteScrollManager } from '$lib/utils/infiniteScroll';
	import { browser } from '$app/environment';

interface TimelinePost extends PostWithInteractions {
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}
	let infiniteScrollManager: InfiniteScrollManager | null = null;
	let homeHasMore = true;
	let homeLoadingMore = false;
	let homeLoading = false;
	let homeCurrentOffset = 0;
	let homePosts: PostWithInteractions[] = [];
	const HOME_POSTS_PER_PAGE = 10;
	let postComposerRef: any; // Reference to PostComposer component
	let enableAutoTagging = true; // Enable/disable auto-tagging
	let taggingModel: AIModel | null = null; // Optional: specify a different model for tagging
	let showPostModal = false;
	let isCommentModalOpen = false;
	let selectedPost: PostWithInteractions | null = null;
	let loadingProfiles = false;
	let userProfilesMap: Map<string, Partial<User> | null> = new Map();
	let loadingMore = false;
	let hasMore = true;
	let currentOffset = 0;
	const POSTS_PER_PAGE = 10;
	// Helper function to batch fetch user profiles using your existing function
	
async function fetchUserProfiles(userIds: string[]): Promise<void> {
	const fetchPromises = userIds.map(async (userId) => {
		try {
			const userData = await getPublicUserData(userId);
			userProfilesMap.set(userId, userData);
		} catch (error) {
			console.error(`Error fetching profile for user ${userId}:`, error);
			userProfilesMap.set(userId, null);
		}
	});

	// Process in batches of 5
	const batchSize = 5;
	for (let i = 0; i < fetchPromises.length; i += batchSize) {
		const batch = fetchPromises.slice(i, i + batchSize);
		await Promise.all(batch);
	}

	userProfilesMap = new Map(userProfilesMap);
}

	function openPostModal() {
		if (!$currentUser) {
			goto('/login');
			return;
		}
		showPostModal = true;
	}

	function closePostModal() {
		showPostModal = false;
	}

	async function handlePostSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>
	) {
		try {
			const { content, attachments, parentId } = event.detail;

			// Create the post first (existing functionality)
			const newPost = await postStore.addPost(content, attachments, parentId);

			console.log('Post created successfully:', newPost.id);

			// Handle auto-tagging if enabled and conditions are met
			// Only tag main posts (not comments) that meet minimum requirements
			if (enableAutoTagging && shouldGenerateTags(content) && get(currentUser)?.id && !parentId) {
				console.log('Starting auto-tagging for post:', newPost.id);

				try {
					// Use the tagging model or fall back to default
					const modelToUse = taggingModel || defaultModel;

					await processPostTaggingAsync(content, newPost.id, modelToUse, get(currentUser)!.id);

					console.log('Auto-tagging initiated for post:', newPost.id);
				} catch (taggingError) {
					console.error('Auto-tagging failed for post:', newPost.id, taggingError);
				}
			} else if (!parentId) {
				const reasons = [];
				if (!enableAutoTagging) reasons.push('auto-tagging disabled');
				if (!shouldGenerateTags(content)) reasons.push('content too short');
				if (!get(currentUser)?.id) reasons.push('user not authenticated');

				if (reasons.length > 0) {
					console.log('Auto-tagging skipped:', reasons.join(', '));
				}
			}
		} catch (err) {
			console.error('Error creating post:', err);
		}
	}
function handleTaggingComplete(event) {
	const { postId, success } = event.detail;
	
	if (success) {
		console.log('✅ Tags generated successfully for post:', postId);
	} else {
		console.log('❌ Auto-tagging failed for post:', postId);
	}
}


async function handlePostInteraction(
  event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
) {
  const { postId, action } = event.detail;
  
  // Extract real post ID if it's a composite key
  const realPostId = extractRealPostId(postId);
  
  console.log('🎯 Handling interaction:', {
    receivedPostId: postId,
    realPostId,
    action,
    isCompositeKey: postId !== realPostId
  });

  try {
    // Actions that require authentication
    if ((action === 'upvote' || action === 'repost' || action === 'read') && !$currentUser) {
      toast.warning('Please sign in to interact with posts');
      return;
    }

    // Process the actions using the real post ID
    if (action === 'upvote') {
      const result = await postStore.toggleUpvote(realPostId);
      // Update local state if needed
      updateLocalPostState(realPostId, 'upvote', result);
    } else if (action === 'repost') {
      const result = await postStore.toggleRepost(realPostId);
      updateLocalPostState(realPostId, 'repost', result);
      if (result.reposted) {
        toast.success('Post reposted!');
      } else {
        toast.info('Repost removed');
      }
    }
    // ... rest of your actions
  } catch (err) {
    console.error(`Error ${action}ing post:`, err);
    // Your existing error handling
  }
}

// Helper function to extract real post ID from composite keys
function extractRealPostId(postId: string): string {
  if (postId.startsWith('repost_')) {
    // Format: repost_originalPostId_repostedBy_created
    const parts = postId.split('_');
    if (parts.length >= 2) {
      return parts[1]; // Original post ID
    }
  }
  return postId; // Already a real post ID
}

// Helper function to update local state (if you're using homePosts)
function updateLocalPostState(realPostId: string, action: string, result: any) {
  if (action === 'upvote' && homePosts.length > 0) {
    homePosts = homePosts.map(post => {
      // Update both original posts and reposts of the same post
      const shouldUpdate = post.id === realPostId || 
                          (post.isRepost && post.originalPostId === realPostId);
      
      if (shouldUpdate) {
        return {
          ...post,
          upvote: result.upvoted,
          upvoteCount: result.upvoteCount,
          downvote: result.upvoted ? false : post.downvote,
          downvoteCount: result.downvoteCount || post.downvoteCount
        };
      }
      return post;
    });
  }
}

	// Handle opening comment modal (from PostCard)
	function handleComment(event: CustomEvent<{ postId: string }>) {
		if (!$currentUser) {
			// Redirect to login or show login prompt
			alert('Please sign in to comment on posts');
			return;
		}

		const post = posts.find((p) => p.id === event.detail.postId);
		if (post) {
			selectedPost = post;
			isCommentModalOpen = true;
		}
	}

// Handle submitting a comment (from PostCommentModal)
async function handleCommentSubmit(
	event: CustomEvent<{ content: string; attachments: File[]; parentId: string }>
): Promise<Result<void, string>> {
	const { content, attachments, parentId } = event.detail;
	
	console.log('🔥 COMMENT SUBMIT DEBUG START');
	console.log('📝 Comment data:', { content, attachments, parentId });
	console.log('📋 Selected post:', selectedPost);

	// Store the post data IMMEDIATELY before any async operations
	const postForRedirect = selectedPost;
	console.log('💾 Stored post for redirect:', postForRedirect);

	// Validate user authentication
	const userValidation = validationTryCatch(() => {
		if (!$currentUser) {
			throw new Error('User not logged in');
		}
		return $currentUser;
	}, 'user authentication');

	if (isFailure(userValidation)) {
		console.error('❌ User validation failed:', userValidation.error);
		return { data: null, error: userValidation.error, success: false };
	}

	console.log('✅ User validation passed:', userValidation.data);

	// Add the comment
	console.log('📤 Adding comment...');
	const commentResult = await clientTryCatch(
		postStore.addPost(content, attachments, parentId),
		'Adding comment'
	);

	if (isFailure(commentResult)) {
		console.error('❌ Error posting comment:', commentResult.error);
		return { data: null, error: commentResult.error, success: false };
	}

	console.log('✅ Comment added successfully:', commentResult.data);

	// Close the modal after successful comment
	console.log('🔒 Closing modal...');
	isCommentModalOpen = false;
	selectedPost = null; // Clear this early
	
	// DEBUG: Check if stored post exists and has required data
	console.log('🔍 REDIRECT DEBUG:');
	console.log('postForRedirect exists:', !!postForRedirect);
	console.log('postForRedirect value:', postForRedirect);
	
	if (postForRedirect) {
		console.log('📊 postForRedirect fields:');
		console.log('- id:', postForRedirect.id);
		console.log('- author_username:', postForRedirect.author_username);
		console.log('- expand:', postForRedirect.expand);
		console.log('- expand.user:', postForRedirect.expand?.user);
		console.log('- expand.user.username:', postForRedirect.expand?.user?.username);
		
		// Get username from the post data
		const username = postForRedirect.author_username || postForRedirect.expand?.user?.username;
		console.log('🎯 Extracted username:', username);
		
		if (username) {
			const redirectUrl = `/${username}/posts/${postForRedirect.id}`;
			console.log('🚀 Attempting redirect to:', redirectUrl);
			
			try {
				await goto(redirectUrl);
				console.log('✅ Redirect successful');
			} catch (error) {
				console.error('❌ Redirect failed:', error);
			}
		} else {
			console.warn('⚠️ Username not found in post data, cannot redirect');
			console.log('Available post data keys:', Object.keys(postForRedirect));
			
			// Try alternative fields
			console.log('Alternative username sources:');
			console.log('- user field:', postForRedirect.user);
			console.log('- author_name:', postForRedirect.author_name);
			
			// If you have the user ID, you might need to fetch the username
			if (postForRedirect.user && typeof postForRedirect.user === 'string') {
				console.log('🔄 Could fetch username using user ID:', postForRedirect.user);
				
				// You could fetch the username here if needed:
				// const userData = await getPublicUserData(postForRedirect.user);
				// if (userData?.username) {
				//     const redirectUrl = `/${userData.username}/posts/${postForRedirect.id}`;
				//     await goto(redirectUrl);
				// }
			}
		}
	} else {
		console.error('❌ postForRedirect is null/undefined - cannot redirect');
	}
	
	console.log('🔥 COMMENT SUBMIT DEBUG END');

	return { data: undefined, error: null, success: true };
}
	async function handleQuote(event: CustomEvent): Promise<Result<void, string>> {
		// Validate user authentication
		const userValidation = validationTryCatch(() => {
			if (!$currentUser) {
				throw new Error('Please sign in to quote posts');
			}
			return $currentUser;
		}, 'user authentication');

		if (isFailure(userValidation)) {
			// Show user-friendly message for quote functionality
			alert(userValidation.error);
			return { data: null, error: userValidation.error, success: false };
		}

		const { content, attachments, quotedPostId } = event.detail;

		const quoteResult = await clientTryCatch(
			postStore.quotePost(quotedPostId, content, attachments),
			'Quoting post'
		);

		if (isFailure(quoteResult)) {
			console.error('Failed to quote post:', quoteResult.error);
			return { data: null, error: quoteResult.error, success: false };
		}

		return { data: undefined, error: null, success: true };
	}

	function handleCloseCommentModal() {
		isCommentModalOpen = false;
		selectedPost = null;
	}

	async function handleFollowUser(event: CustomEvent) {
		const { userId } = event.detail;
		console.log('Follow user action:', userId);

		const userProfile = await getPublicUserData(userId);
		console.log('Following user profile:', userProfile);
	}

$: {
	homeHasMore = $postStore.hasMore;
	homeLoadingMore = $postStore.loadingMore;
	homeLoading = $postStore.loading;
	
	// DEBUG: Let's see what's happening
	console.log('🔍 HOME STATE SYNC:', {
		'Store hasMore': $postStore.hasMore,
		'Store loadingMore': $postStore.loadingMore,
		'Store posts.length': $postStore.posts.length,
		'Local homeHasMore': homeHasMore,
		'Local homeLoadingMore': homeLoadingMore
	});
}

async function fetchHomePosts(offset = 0, append = false) {
	if (!browser) return;

	if (!append) {
		homeLoading = true;
		homeCurrentOffset = 0;
		homeHasMore = true;
		homePosts = [];
	} else {
		homeLoadingMore = true;
	}

	try {
		console.log(`🔍 Fetching home posts with offset: ${offset}, append: ${append}`);
		
		const response = await fetch(`/api/posts?offset=${offset}&limit=${HOME_POSTS_PER_PAGE}`);
		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to load posts');
		}

		// Handle the double nesting from apiTryCatch
		const actualData = data.data || data;
		const newPosts = actualData.posts || [];

		if (!append) {
			homePosts = newPosts;
		} else {
			const existingIds = new Set(homePosts.map(p => p.id));
			const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
			homePosts = [...homePosts, ...uniqueNewPosts];
			console.log(`📊 Added ${uniqueNewPosts.length} new unique posts`);
		}

		// Update pagination state like username page
		const newPostsCount = newPosts.length;
		
		// Use server's hasMore if available, otherwise calculate
		if (actualData.hasMore !== undefined) {
			homeHasMore = actualData.hasMore;
		} else {
			homeHasMore = newPostsCount === HOME_POSTS_PER_PAGE;
		}
		
		// Update offset for next request
		homeCurrentOffset = append ? 
			homeCurrentOffset + newPostsCount : 
			newPostsCount;

		console.log('📊 Home posts updated:', {
			postsCount: homePosts.length,
			newPostsCount,
			hasMore: homeHasMore,
			currentOffset: homeCurrentOffset
		});

	} catch (err) {
		console.error('Error fetching home posts:', err);
	} finally {
		homeLoading = false;
		homeLoadingMore = false;
	}
}

// Load more function like username page
async function loadMoreHomePosts() {
	if (homeLoadingMore || !homeHasMore) {
		console.log('⛔ Load more skipped:', { homeLoadingMore, homeHasMore });
		return;
	}

	console.log('🚀 Loading more home posts from offset:', homeCurrentOffset);
	await fetchHomePosts(homeCurrentOffset, true);
}

// Setup infinite scroll exactly like username page
function setupInfiniteScroll() {
	if (infiniteScrollManager) {
		infiniteScrollManager.destroy();
	}

	infiniteScrollManager = new InfiniteScrollManager({
		loadMore: async () => {
			try {
				await loadMoreHomePosts();
			} catch (error) {
				console.error('Error loading more home posts:', error);
			}
		},
		hasMore: () => homeHasMore,
		isLoading: () => homeLoadingMore,
		triggerId: 'home-loading-trigger',
		debug: true
	});

	infiniteScrollManager.setup();
	return infiniteScrollManager;
}


function handlePostCreated(event) {
	const { postId, post } = event.detail;
	
	if (!post || !postId) {
		console.log('❌ Invalid post data received');
		return;
	}
	
	console.log('✅ Post created successfully:', postId);
	// Note: PostComposer already called postStore.addPost, so the post is already in the store
	// This event is just for additional side effects if needed
}
function debugAllEvents(event: any) {
	console.log('🔥 ALL EVENTS DEBUG:', {
		type: event.type,
		detail: event.detail,
		target: event.target?.tagName,
		currentTarget: event.currentTarget?.tagName
	});
}

$: posts = $postStore.posts;
$: loading = $postStore.loading;
$: loadingMore = $postStore.loadingMore;
$: hasMore = $postStore.hasMore;
$: error = $postStore.error;

// ADD THIS: Deduplicate posts to prevent duplicate keys
$: uniquePosts = posts.reduce((acc: TimelinePost[], post: TimelinePost, index: number) => {
	const postKey = post.isRepost 
		? `repost_${post.originalPostId}_${post.repostedBy_id}_${post.created}` 
		: post.id;
	
	const existingIndex = acc.findIndex((p: TimelinePost) => {
		const existingKey = p.isRepost 
			? `repost_${p.originalPostId}_${p.repostedBy_id}_${p.created}` 
			: p.id;
		return existingKey === postKey;
	});
	
	if (existingIndex === -1) {
		acc.push(post);
	} else {
		console.log(`🔄 Removing duplicate post key: ${postKey} at index ${index}`);
	}
	
	return acc;
}, []);

$: userIds = [
	...new Set(
		uniquePosts.flatMap((post: TimelinePost) => {
			const ids = [post.user];
			if (post.repostedBy && Array.isArray(post.repostedBy)) {
				ids.push(...post.repostedBy);
			}
			return ids;
		})
	)
];
// CHANGE THIS: Use uniquePosts instead of posts for enhancedPosts
$: enhancedPosts = homePosts.map((post) => {
  const authorProfile = userProfilesMap.get(post.user);
  
  const enhancedPost = {
    ...post,
    // Ensure ID is always the real post ID for interactions
    id: post.isRepost && post.originalPostId ? post.originalPostId : post.id,
    // Keep track of original data for display
    _isRepost: post.isRepost,
    _originalId: post.id,
    _displayKey: post.isRepost 
      ? `repost_${post.originalPostId}_${post.repostedBy_id}_${post.created}` 
      : post.id
  };

  if (authorProfile) {
    return {
      ...enhancedPost,
      authorProfile,
      author_name: authorProfile.name || post.author_name,
      author_username: authorProfile.username || post.author_username,
      author_avatar: authorProfile.avatar || post.author_avatar
    };
  }

  return enhancedPost;
});

// CHANGE THIS: Use uniquePosts.length instead of posts.length
$: if (uniquePosts.length > 0 && userIds.length > 0 && !loadingProfiles) {
	const missingUserIds = userIds.filter((id) => !userProfilesMap.has(id));

	if (missingUserIds.length > 0) {
		loadingProfiles = true;
		fetchUserProfiles(missingUserIds)
			.then(() => {
				loadingProfiles = false;
			})
			.catch((err) => {
				console.error('Error fetching user profiles:', err);
				loadingProfiles = false;
			});
	}
}

// CHANGE THIS: Use uniquePosts.length in logging
$: if (typeof window !== 'undefined') {
	console.log('📊 Current state:', {
		totalPosts: posts.length,
		uniquePostsCount: uniquePosts.length,
		duplicatesRemoved: posts.length - uniquePosts.length,
		hasMore: $postStore.hasMore,
		loadingMore: $postStore.loadingMore,
		triggerExists: !!document.getElementById('loading-trigger')
	});
}
onMount(async () => {
	console.log('🔄 Home page mounted - setting up...');
	
	// Fetch initial data like username page
	await fetchHomePosts(0, false);

	// Setup infinite scroll
	console.log('🔧 Setting up infinite scroll...');
	setupInfiniteScroll();
	
	// Try to attach with retries
	if (infiniteScrollManager) {
		infiniteScrollManager.attachWithRetry(10, 100).then((success) => {
			if (success) {
				console.log('✅ Infinite scroll ready!');
			} else {
				console.error('❌ Failed to setup infinite scroll');
			}
		});
	}

	console.log('✅ Home page setup complete');

	// Cleanup function
	return () => {
		console.log('🧹 Cleaning up infinite scroll...');
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
			infiniteScrollManager = null;
		}
	};
});

$: {
	console.log('🔄 REACTIVE STATE UPDATE:');
	console.log('   Posts count:', posts.length);
	console.log('   Loading:', loading);
	console.log('   LoadingMore:', $postStore.loadingMore);
	console.log('   HasMore:', $postStore.hasMore);
	console.log('   Error:', error);
	console.log('   Enhanced posts count:', enhancedPosts.length);
	
	if (posts.length === 0 && !loading && !error) {
		console.log('⚠️ EMPTY STATE: No posts, not loading, no error - this suggests API returned empty result');
	}
}

	/*
	 * Reactive statements for debugging
	 * $: console.log('Sidenav visibility changed:', $showSidenav);
	 * $: console.log('Posts:', posts);
	 * $: console.log('Loading:', loading);
	 * $: console.log('Error:', error);
	 */
</script>

<div
	class="home-container"
	class:hide-left-sidebar={!$showSidenav}
	class:drawer-visible={$showSidenav}
>
	<!-- Left Sidebar Component -->

	<PostSidenav />

	<!-- Main Content -->
	<main class="main-content">
		<!-- <img src={Greek} alt="Notes illustration" class="illustration left" />
		<img src={Headmaster} alt="Notes illustration" class="illustration center" />
		<img src={Italian} alt="Notes illustration" class="illustration right" /> -->
		<div class="main-wrapper">
			<!-- Error Display -->
			{#if error}
				<div class="error-message">
					{error}
				</div>
			{/if}

			<!-- Loading State -->
			{#if loading && posts.length === 0}
				<!-- <div class="loading-trigger">
				</div> -->
			{:else if posts.length === 0 && !loading}
				<!-- <div class="loading-trigger">
				</div> -->
			{/if}

			<!-- Posts Feed -->
<section class="posts-feed">
{#each enhancedPosts as post (post._displayKey || post.id)}		
{#if post.isRepost}
			<RepostCard
				{post}
				repostedBy={{
					id: $currentUser?.id,
					username: $currentUser?.username,
					name: $currentUser?.name,
					avatar: $currentUser?.avatar
				}}
				on:interact={handlePostInteraction}
				on:comment={handleComment}
				on:quote={handleQuote}
			/>
		{:else if post.quotedPost}
			<PostQuoteCard
				{post}
				quotedBy={{
					id: post.user,
					username: post.author_username,
					name: post.author_name,
					avatar: post.author_avatar
				}}
				on:interact={handlePostInteraction}
				on:comment={handleComment}
				on:quote={handleQuote}
			/>
		{:else}
			<PostCard
				{post}
				on:interact={handlePostInteraction}
				on:comment={handleComment}
				on:quote={handleQuote}
			/>
		{/if}
	{/each}
	
	<!-- Use store values instead of local variables -->
{#if homeHasMore}
		<div id="home-loading-trigger" class="loading-trigger">
			{#if homeLoadingMore}
				<div class="loading-indicator">
					<div class="trigger-loader" in:fly={{ y:50, duration: 300 }} out:fly={{ y: -50, duration: 200 }}></div>
					<!-- <span>Loading more posts...</span> -->
				</div>
			{:else}
				<div class="loading-indicator" >
					<div class="trigger-loader" in:fly={{ y:50, duration: 300 }} out:fly={{ y: -50, duration: 200 }}></div>
					<!-- <span>Scroll for more...</span> -->
				</div>
			{/if}
		</div>
	{:else if $postStore.posts.length > 0}
		<div class="end-of-posts" style="text-align: center; padding: 20px; color: #666;">
			<p>No more posts to load</p>
			<p>Total posts: {$postStore.posts.length}</p>
		</div>
	{/if}
</section>
			{#if $showInput && $currentUser}
				<div class="composer-overlay">
					<div
						class="composer-body"
						in:fly={{ y: 200, duration: 300 }}
						out:fly={{ y: 200, duration: 300 }}
					>
						<PostComposer
							bind:this={postComposerRef}
							{enableAutoTagging}
							{taggingModel}
							on:submit={handlePostSubmit}
							on:taggingComplete={handleTaggingComplete}
						/>
					</div>
				</div>
			{/if}
		</div>
	</main>

	<!-- Right Sidebar Component -->
	{#if $showRightSidenav && $currentUser}
		<div class="side-menu">
			<AiMenu width={400} userId={$currentUser.id} />
		</div>
	{/if}
</div>
<!-- {#if browser}
<div style="position: fixed; top: 10px; right: 10px; background: #333; color: white; padding: 15px; font-size: 14px; z-index: 9999; border-radius: 8px; min-width: 200px;">
	<div>🔄 Scroll Debug</div>
	<div>Observer: {infiniteScrollManager ? '✅' : '❌'}</div>
	<div>Attached: {infiniteScrollManager?.isObserverAttached ? '✅' : '❌'}</div>
	<div>Trigger: {document?.getElementById('home-loading-trigger') ? '✅' : '❌'}</div>
	<div>Has More (local): {homeHasMore ? '✅' : '❌'}</div>
	<div>Loading (local): {homeLoadingMore ? '⏳' : '💤'}</div>
	<div>Has More (store): {$postStore.hasMore ? '✅' : '❌'}</div>
	<div>Posts: {$postStore.posts.length}</div>
	<div style="margin-top: 10px;">
		<button 
			style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"
			on:click={() => {
				console.log('🚀 Manual trigger loadMorePosts from local function');
				loadMoreHomePosts();
			}}
		>
			Manual Load More
		</button>
	</div>
	<div style="margin-top: 5px;">
		<button 
			style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"
			on:click={() => {
				console.log('🔄 Recreate infinite scroll');
				setupInfiniteScroll();
				if (infiniteScrollManager) {
					infiniteScrollManager.attachWithRetry(5, 50);
				}
			}}
		>
			Recreate Scroll
		</button>
	</div>
</div>
{/if} -->
<!-- Arrow indicator for scroll position -->
<!-- <div style="position: fixed; bottom: 100px; right: 10px; z-index: 9999;">
	{#if hasMore && !loadingMore}
		<div style="background: #28a745; color: white; padding: 10px; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 20px; animation: bounce 2s infinite;">
			↓
		</div>
	{/if}
	{#if loadingMore}
		<div style="background: #ffc107; color: black; padding: 10px; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; animation: spin 1s linear infinite;">
			⟳
		</div>
	{/if}
</div> -->

<PostCommentModal
	isOpen={isCommentModalOpen && $currentUser !== null}
	post={selectedPost}
	on:close={handleCloseCommentModal}
	on:comment={handleCommentSubmit}
	on:submit={debugAllEvents}
	on:*={debugAllEvents}
/>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.home-container {
		display: flex;
		justify-content: center;
		height: 100vh;
		width: 100%;
		margin-bottom: 2rem;
		padding-bottom: 3rem;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 60%);
	}
	@keyframes bounce {
		0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
		40% { transform: translateY(-10px); }
		60% { transform: translateY(-5px); }
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	.drawer-visible.home-container {
		justify-content: space-around;
	}
	main {
		width: 100%;
		display: flex;
	}
	.main-content {
		flex: 1;
		padding: 0.5rem;
		max-width: 100vh;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		margin-bottom: 0;
		justify-content: center;

		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}

	.main-wrapper {
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
	}
	.loading-trigger {
		height: 100px !important;
		margin-bottom: 100px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		position: relative;
	}

.trigger-loader {
  width: 20px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--tertiary-color);
  box-shadow: 0 0 0 0 var(--tertiary-color);
  animation: l2 1.5s infinite linear;
  position: relative;
}
.trigger-loader:before,
.trigger-loader:after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 0 0 var(--tertiary-color);
  animation: inherit;
  animation-delay: -0.5s;
}
.trigger-loader:after {
  animation-delay: -1s;
}
@keyframes l2 {
    100% {box-shadow: 0 0 0 40px var(--primary-color)}
}
	.side-menu {
		max-width: 25vw;
		width: 100%;
	}

	.create-post {
		margin-bottom: 2rem;
	}

	.feed-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: var(--text-color);
	}

	.posts-feed {
		display: flex;
		flex-direction: column;
		justify-content: center;
		height: auto;
		gap: 0;
	}

	.error-message {
		padding: 1rem;
		background-color: rgba(255, 0, 0, 0.1);
		border: 1px solid rgba(255, 0, 0, 0.3);
		border-radius: 8px;
		color: #ff3333;
		margin-bottom: 1rem;
	}

	.loading-state {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
		color: var(--text-color);
		opacity: 0.7;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 0;
		color: var(--text-color);
		opacity: 0.7;
	}

	.login-prompt {
		background-color: var(--bg-color);
		border: 1px dashed var(--line-color);
		border-radius: 8px;
		padding: 1.5rem;
		text-align: center;
		color: var(--text-color);
	}

	.login-prompt a {
		color: var(--primary-color);
		text-decoration: none;
		font-weight: 600;
	}

	.login-prompt a:hover {
		text-decoration: underline;
	}
	img {
		-webkit-user-drag: none;
		-khtml-user-drag: none;
		-moz-user-drag: none;
		-o-user-drag: none;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}
	.illustration {
		position: absolute;
		opacity: 0.03;
		width: 100%;
		height: auto;
		user-select: none;
		// transform: scale(1) translateX(-50%) translateY(0%);
		z-index: -1;
		&.left {
			transform: scale(1) translateX(-70%) translateY(-5%);
		}
		&.center {
			transform: scale(0.5) translateX(-50%) translateY(-50%);
			display: none;
		}
		&.right {
			// opacity: 1;
			transform: scale(-1, 1) translateX(-10%) translateY(0%);
		}
	}
	.create-post-button {
		width: 100%;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 1rem;
	}

	.create-post-button:hover {
		border-color: #3b82f6;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
	}

	.button-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.button-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
	}

	.button-text {
		color: #6b7280;
		font-size: 1rem;
		text-align: left;
		flex: 1;
	}

	.close-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6b7280;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #374151;
	}
	.composer-overlay {
		position: absolute;
		bottom: 3rem;
		left: 0;
		width: 100%;
		height: auto;
		// background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		// padding: 1rem;
	}
	.composer-body {
		padding: 0;
		overflow-y: auto;
		flex: 1;
		position: relative;
		max-width: 600px;
		width: 100%;
		bottom: 0;
		left: 0;
		right: 0;
		border-radius: 2rem;
		border: 2px solid var(--line-color);
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.5);
	}

	.login-prompt {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		margin-bottom: 1rem;
	}

	.login-prompt p {
		margin: 0;
		color: #6b7280;
	}

	.login-prompt a {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
	}

	.login-prompt a:hover {
		text-decoration: underline;
	}

	@media (max-width: 1000px) {
		main {
			width: 100%;
			display: flex;
		}
		.side-menu {
			max-width: 75vw;
			width: 100%;
		}
	}
</style>
