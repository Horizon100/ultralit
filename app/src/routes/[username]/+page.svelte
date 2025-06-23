<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly, fade } from 'svelte/transition';
	import {
		pocketbaseUrl,
		currentUser,
		getPublicUserData,
		getPublicUserByUsername, 
		getPublicUsersBatch
	} from '$lib/pocketbase';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import RepostCard from '$lib/features/posts/components/RepostCard.svelte';
	import PostQuoteCard from '$lib/features/posts/components/PostQuoteCard.svelte';
	import { postStore } from '$lib/stores/postStore';
	import PostSidenav from '$lib/features/posts/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/posts/components/PostTrends.svelte';
	import { showSidenav, showRightSidenav, showInput} from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { browser } from '$app/environment';
	import BackButton from '$lib/components/buttons/BackButton.svelte';
	import {
		Calendar,
		MapPin,
		Link as LinkIcon,
		Mail,
		MessageSquare,
		Settings,
		Loader2,
		ArrowLeft,

		UserIcon

	} from 'lucide-svelte';

	import { clientTryCatch, validationTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import { toast } from '$lib/utils/toastUtils';
	import type { AIModel, User } from '$lib/types/types';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	import { InfiniteScrollManager } from '$lib/utils/infiniteScroll';
	import DmHeader from '$lib/features/dm/components/DMHeader.svelte';
	import DmDrawer from '$lib/features/dm/components/DMDrawer.svelte';
	import DmInput from '$lib/features/dm/components/DMInput.svelte';
	import DmChat from '$lib/features/dm/components/DMChat.svelte';
	import DMModule from '$lib/features/dm/components/DMModule.svelte';

	// State
	export let data;
	let dmModule: DMModule;
	let selectedUserId: string | null = null;
	let loading = true;
	let error = '';
	let user: any = null;
	let profile: any = null;
	let userPosts: PostWithInteractions[] = [];
	let totalPosts = 0;
	let innerWidth = 0;
	let userProfilesMap: Map<string, Partial<User> | null> = new Map();
	
	// Fixed infinite scroll state variables
	let profileLoadingMore = false;
	let profileHasMore = true;
	let profileCurrentOffset = 0;
	const PROFILE_POSTS_PER_PAGE = 10;
	
	// NEW: Infinite scroll manager
	let infiniteScrollManager: InfiniteScrollManager | null = null;

	// Other state variables...
	let postComposerRef: any;
	let enableAutoTagging = true;
	let taggingModel: AIModel | null = null;
	let showPostModal = false;
	let isCommentModalOpen = false;
	let selectedPost: PostWithInteractions | null = null;
	let loadingProfiles = false;

	// Get username from URL
	$: username = $page.params.username;

	// Helper function to fetch user profiles (same as before)
	async function fetchUserProfiles(userIds: string[]): Promise<void> {
		const result = await clientTryCatch((async () => {
			const profiles = await getPublicUsersBatch(userIds);
			profiles.forEach((profile) => {
				if (profile && profile.id) {
					userProfilesMap.set(profile.id, profile);
				}
			});
			userIds.forEach((id) => {
				if (!userProfilesMap.has(id)) {
					userProfilesMap.set(id, null);
				}
			});
			userProfilesMap = new Map(userProfilesMap);
			return profiles;
		})(), `Fetching user profiles for ${userIds.length} users`);

		if (isFailure(result)) {
			console.error('Error fetching user profiles:', result.error);
			// Fallback logic...
		}
	}
function toggleDM() {
		showInput = !showInput;
	}

	function startConversationWith(userId: string) {
		selectedUserId = userId;
		showInput = true;
		
		setTimeout(() => {
			if (dmModule) {
				dmModule.startNewConversation(userId);
			}
		}, 100);
	}

	// FIXED: Main fetch function
	async function fetchUserData(offset = 0, append = false) {
		if (!username || !browser) return;

		if (!append) {
			loading = true;
			profileCurrentOffset = 0;
			profileHasMore = true;
			userPosts = [];
		} else {
			profileLoadingMore = true; // Set loading state for pagination
		}
		
		error = '';

		try {
			console.log(`🔍 Fetching user data with offset: ${offset}, append: ${append}`);
			
			const response = await fetch(`/api/users/username/${username}?offset=${offset}&limit=${PROFILE_POSTS_PER_PAGE}`);
			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to load user data';
				return;
			}

			const actualData = data.data || data;
			
			if (!append) {
				user = actualData.user;
				userPosts = actualData.posts || [];
			} else {
				const newPosts = actualData.posts || [];
				const existingIds = new Set(userPosts.map(p => p.id));
				const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
				userPosts = [...userPosts, ...uniqueNewPosts];
				console.log(`📊 Added ${uniqueNewPosts.length} new unique posts`);
			}

			// FIXED: Update pagination state correctly
			const newPostsCount = (actualData.posts || []).length;
			
			// Use server's hasMore if available, otherwise calculate
			if (actualData.hasMore !== undefined) {
				profileHasMore = actualData.hasMore;
			} else {
				profileHasMore = newPostsCount === PROFILE_POSTS_PER_PAGE;
			}
			
			// Update offset for next request
			profileCurrentOffset = append ? 
				profileCurrentOffset + newPostsCount : 
				newPostsCount;
			
			totalPosts = actualData.totalPosts || userPosts.length;

			console.log('📊 Profile data updated:', {
				postsCount: userPosts.length,
				newPostsCount,
				hasMore: profileHasMore,
				currentOffset: profileCurrentOffset,
				totalPosts: totalPosts
			});

			// Fetch user profiles for enhanced display
			const userIds = [
				...new Set(
					userPosts.flatMap((post) => {
						const ids = [post.user];
						if (post.repostedBy && Array.isArray(post.repostedBy)) {
							ids.push(...post.repostedBy);
						}
						return ids;
					})
				)
			];

			if (userIds.length > 0) {
				await fetchUserProfiles(userIds);
			}

			// Enhance posts with profile data
			userPosts = userPosts.map((post) => {
				const authorProfile = userProfilesMap.get(post.user);
				if (authorProfile) {
					return {
						...post,
						authorProfile,
						author_name: authorProfile.name || post.author_name,
						author_username: authorProfile.username || post.author_username,
						author_avatar: authorProfile.avatar || post.author_avatar
					};
				}
				return post;
			});
			
		} catch (err) {
			console.error('Error fetching user data:', err);
			error = 'Failed to load user data';
		} finally {
			loading = false;
			profileLoadingMore = false; // Always reset loading state
		}
	}

	// NEW: Load more function for infinite scroll
	async function loadMoreProfilePosts() {
		if (profileLoadingMore || !profileHasMore) {
			console.log('⛔ Load more skipped:', { profileLoadingMore, profileHasMore });
			return;
		}

		console.log('🚀 Loading more profile posts from offset:', profileCurrentOffset);
		await fetchUserData(profileCurrentOffset, true);
	}

	// NEW: Setup infinite scroll
	function setupInfiniteScroll() {
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
		}

		infiniteScrollManager = new InfiniteScrollManager({
			loadMore: async () => {
				try {
					await loadMoreProfilePosts();
				} catch (error) {
					console.error('Error loading more profile posts:', error);
				}
			},
			hasMore: () => profileHasMore,
			isLoading: () => profileLoadingMore,
			triggerId: 'profile-loading-trigger', // FIXED: Use correct trigger ID
			debug: true // Enable debugging
		});

		infiniteScrollManager.setup();
		return infiniteScrollManager;
	}


	function formatJoinDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		});
	}

// Updated handlePostInteraction function for username page
async function handlePostInteraction(
	event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
) {
	const { postId, action } = event.detail;

	if (!$currentUser && action !== 'share') {
		toast.warning('Please sign in to interact with posts');
		return;
	}

	// Extract real post ID if it's a composite key (for consistency)
	const realPostId = extractRealPostId(postId);
	
	console.log('Username page interaction:', {
		receivedPostId: postId,
		realPostId,
		action,
		isCompositeKey: postId !== realPostId
	});

	try {
		// Apply optimistic updates first for better UX
		let optimisticUpdate = null;
		if (action === 'upvote') {
			optimisticUpdate = applyOptimisticUpvote(realPostId);
		} else if (action === 'repost') {
			optimisticUpdate = applyOptimisticRepost(realPostId);
		}

		// Make API calls through store
		try {
			switch (action) {
				case 'upvote':
					const upvoteResult = await postStore.toggleUpvote(realPostId);
					updateLocalPostState(realPostId, 'upvote', upvoteResult);
					break;

				case 'repost':
					const repostResult = await postStore.toggleRepost(realPostId);
					updateLocalPostState(realPostId, 'repost', repostResult);
					if (repostResult.reposted) {
						toast.success('Post reposted!');
					} else {
						toast.info('Repost removed');
					}
					break;

				case 'read':
					await postStore.markAsRead(realPostId);
					updateLocalPostState(realPostId, 'read', { hasRead: true });
					break;

				case 'share':
					// Find the post to get username for share URL
					const targetPost = userPosts.find(p => p.id === realPostId || 
						(p.isRepost && p.originalPostId === realPostId));
					
					const shareResult = await postStore.sharePost(realPostId, targetPost?.author_username);
					
					// Handle share result with toast messages
					if (shareResult.copied) {
						if (shareResult.copyMethod === 'execCommand') {
							toast.success('Link copied to clipboard!');
						} else {
							toast.success(shareResult.message || 'Link copied to clipboard!');
						}
					} else {
						if (shareResult.shareCount !== undefined) {
							toast.success('Post shared successfully!');
							toast.warning('Automatic copy failed - please copy manually', 4000);
							setTimeout(() => {
								toast.info(`Copy: ${shareResult.url}`, 10000);
							}, 1000);
						} else {
							toast.warning('Could not copy automatically');
							setTimeout(() => {
								toast.info(`Copy: ${shareResult.url}`, 10000);
							}, 500);
						}
					}
					break;
			}

			console.log(`${action} successful for post ${realPostId}`);

		} catch (error) {
			// Revert optimistic updates on error
			if (optimisticUpdate) {
				revertOptimisticUpdate(optimisticUpdate);
			}
			throw error;
		}

	} catch (err) {
		console.error(`Error ${action}ing post:`, err);
		
		// Show specific error messages
		switch (action) {
			case 'upvote':
				toast.error('Failed to upvote post');
				break;
			case 'repost':
				toast.error('Failed to repost');
				break;
			case 'read':
				toast.error('Failed to mark as read');
				break;
			case 'share':
				toast.error('Failed to share post');
				const postUrl = `${window.location.origin}/posts/${realPostId}`;
				setTimeout(() => {
					toast.info(`Manual copy: ${postUrl}`, 10000);
				}, 500);
				break;
			default:
				toast.error(`Failed to ${action} post`);
		}
	}
}

// Helper function to extract real post ID (same as other pages)
function extractRealPostId(postId: string): string {
	if (postId.startsWith('repost_')) {
		const parts = postId.split('_');
		if (parts.length >= 2) {
			return parts[1];
		}
	}
	return postId;
}

// Optimistic update functions for better UX
function applyOptimisticUpvote(postId: string) {
	const originalPosts = [...userPosts];
	
	userPosts = userPosts.map((post) => {
		// Update both original posts and reposts of the same post
		const shouldUpdate = post.id === postId || 
							(post.isRepost && post.originalPostId === postId);
		
		if (shouldUpdate) {
			return {
				...post,
				upvote: !post.upvote,
				upvoteCount: post.upvote 
					? (post.upvoteCount || 1) - 1 
					: (post.upvoteCount || 0) + 1,
				downvote: false // Remove downvote when upvoting
			};
		}
		return post;
	});
	
	return originalPosts;
}

function applyOptimisticRepost(postId: string) {
	const originalPosts = [...userPosts];
	
	userPosts = userPosts.map((post) => {
		const shouldUpdate = post.id === postId || 
							(post.isRepost && post.originalPostId === postId);
		
		if (shouldUpdate) {
			return {
				...post,
				repost: !post.repost,
				repostCount: post.repost 
					? (post.repostCount || 1) - 1 
					: (post.repostCount || 0) + 1
			};
		}
		return post;
	});
	
	return originalPosts;
}

function revertOptimisticUpdate(originalPosts: PostWithInteractions[]) {
	userPosts = originalPosts;
}

// Function to update local state with server response
function updateLocalPostState(postId: string, action: string, data: any) {
	userPosts = userPosts.map((post) => {
		// Update both original posts and reposts of the same post
		const shouldUpdate = post.id === postId || 
							(post.isRepost && post.originalPostId === postId);
		
		if (!shouldUpdate) return post;

		switch (action) {
			case 'upvote':
				return {
					...post,
					upvote: data.upvoted,
					upvoteCount: data.upvoteCount,
					downvote: data.upvoted ? false : post.downvote,
					downvoteCount: data.downvoteCount || post.downvoteCount
				};

			case 'repost':
				return {
					...post,
					repost: data.reposted,
					repostCount: data.repostCount
				};

			case 'read':
				return {
					...post,
					hasRead: data.hasRead
				};

			default:
				return post;
		}
	});
}

// Add enhanced posts reactive statement for consistency with home page
$: enhancedUserPosts = userPosts.map((post) => {
	const authorProfile = userProfilesMap.get(post.user);
	
	// Ensure proper ID handling for interactions
	const enhancedPost = {
		...post,
		// For reposts, keep the original ID separate from display ID
		id: post.isRepost && post.originalPostId ? post.originalPostId : post.id,
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

// Update your posts rendering to use enhancedUserPosts
// In your template:
// {#each enhancedUserPosts as post (post._displayKey || post.id)}

// Enhanced debugging
$: {
	console.log('🔄 USERNAME PAGE STATE:', {
		userPostsLength: userPosts.length,
		enhancedPostsLength: enhancedUserPosts?.length || 0,
		profileHasMore,
		profileLoadingMore,
		profileCurrentOffset,
		totalPosts,
		observerAttached: infiniteScrollManager?.isObserverAttached
	});
}

	async function handleQuote(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		if (!$currentUser) {
			toast.error('Please sign in to quote posts');
			return;
		}

		const { content, attachments, quotedPostId } = event.detail;

		const result = await clientTryCatch(
			postStore.quotePost(quotedPostId, content, attachments),
			'Quote post operation'
		);

		if (result.success) {
			const fetchResult = await clientTryCatch(fetchUserData(), 'Fetch user data');
			
			if (!fetchResult.success) {
				console.error('Failed to refresh user data:', fetchResult.error);
				toast.warning('Posted successfully but failed to refresh feed');
			} else {
				toast.success('Post quoted successfully!');
			}
		} else {
			console.error('Failed to quote post:', result.error);
			
			let userMessage = 'Failed to quote post';
			if (result.error.includes('not found')) {
				userMessage = 'Original post not found';
			} else if (result.error.includes('permission')) {
				userMessage = 'You don\'t have permission to quote this post';
			} else if (result.error.includes('too long')) {
				userMessage = 'Your quote is too long';
			}
			
			toast.error(userMessage);
		}
	}

	function handleComment(event: CustomEvent<{ postId: string }>) {
		if (!$currentUser) {
			alert($t('generic.interactPrompt'));
			return;
		}

		console.log($t('posts.addingComment'), event.detail.postId);
	}

	function handleFollowUser(event: CustomEvent<{ userId: string }>) {
		console.log($t('posts.followUser'), event.detail.userId);
	}

	onMount(async () => {
		console.log('=== USERNAME PAGE MOUNT START ===');
				const handleNewChat = () => {
			// Handle new chat creation - maybe open user selection modal
			console.log('New chat requested from DM module');
			// You could open a user selection modal here
		};

		document.addEventListener('newChat', handleNewChat);
		
		// Fetch initial data
		if (!user && username) {
			await fetchUserData(0, false);
		}

		// NEW: Setup infinite scroll with retry
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

		console.log('=== USERNAME PAGE MOUNT END ===');

		// Cleanup function
		return () => {
			document.removeEventListener('newChat', handleNewChat);
			console.log('🧹 Cleaning up infinite scroll...');
			if (infiniteScrollManager) {
				infiniteScrollManager.destroy();
				infiniteScrollManager = null;
			}
		};
	});
</script>
<svelte:window bind:innerWidth />

<svelte:head>
	<title>{user?.name || user?.username || 'User'} - Profile</title>
	<meta name="description" content="Profile page for {user?.name || user?.username || 'User'}" />
</svelte:head>

<div class="profile-page-container" class:hide-left-sidebar={!$showSidenav}>
	<!-- Left Sidebar Component -->
	{#if $showSidenav}
		<div class="sidebar-container">
			<PostSidenav />
		</div>
	{/if}

	<!-- Main Content -->
	<div class="profile-content-wrapper">
		{#if loading}
			
			<div class="trigger-loader" in:fly={{ y: 200, duration: 300 }} out:fly={{ y: -200, duration: 200 }} >
			</div>
		{:else if error}
			<div class="error-container">
				<h1>{$t('posts.errorExpression')}</h1>
				<p>
					{$t('posts.historySignin')}
				</p>
				<button class="btn btn-primary" on:click={() => goto('/')}>
					{$t('generic.back')}
				</button>
			</div>
		{:else if user}
			<!-- Sticky Header with Back Button -->
			<div class="profile-sticky-header">
				<BackButton />
				<div class="header-username">
					<span class="username-text">{user.name || user.username}</span>
					<span class="post-count">{totalPosts} {$t('posts.posts')} </span>
				</div>
			</div>

			<div class="main-wrapper">
				<!-- Profile Header -->
				<header class="profile-header">
					<div class="profile-background"></div>
					<div class="profile-info">
						<div class="avatar-section">
							<img
								src={user.avatar
									? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
									: '/api/placeholder/120/120'}
								alt="{user.name || user.username}'s avatar"
								class="profile-avatar"
							/>
						</div>

						<div class="user-details">
							<h1 class="user-name">{user.name || user.username}</h1>
							<p class="username">@{user.username}</p>

							{#if profile?.bio}
								<p class="user-bio">{profile.bio}</p>
							{/if}

							<div class="user-meta">
								<div class="meta-item">
									<Calendar size={16} />
									<span>{$t('profile.joined')} {formatJoinDate(user.created)}</span>
								</div>

								{#if profile?.location}
									<div class="meta-item">
										<MapPin size={16} />
										<span>{profile.location}</span>
									</div>
								{/if}

								{#if profile?.website}
									<div class="meta-item">
										<LinkIcon size={16} />
										<a href={profile.website} target="_blank" rel="noopener noreferrer">
											{profile.website}
										</a>
									</div>
								{/if}
							</div>

							<div class="user-stats">
								<div class="stat">
									<span class="stat-number">{totalPosts}</span>
									<span class="stat-label">{$t('posts.posts')} </span>
								</div>

								{#if profile?.follower_count !== undefined}
									<div class="stat">
										<span class="stat-number">{profile.follower_count}</span>
										<span class="stat-label">{$t('profile.followers')} </span>
									</div>
								{/if}

								{#if profile?.following_count !== undefined}
									<div class="stat">
										<span class="stat-number">{profile.following_count}</span>
										<span class="stat-label">{$t('profile.following')}</span>
									</div>
								{/if}
							</div>

							<div class="action-buttons">
								{#if $currentUser}
									<button class="btn btn-primary">
										<MessageSquare size={16} />
										{$t('chat.message')}
									</button>

									<button class="btn btn-secondary">
										<UserIcon size={16} />
										{$t('profile.follow')}
									</button>

									<button class="btn btn-outline">
										<Settings size={16} />
									</button>
								{:else}
									<button class="btn btn-primary" on:click={() => goto('/login')}>
										<UserIcon size={16} />
										{$t('generic.signin')}
									</button>
								{/if}
							</div>
						</div>
					</div>
				</header>

				<!-- Profile Content -->
				<main class="profile-content">
					<div class="content-nav">
						<nav class="tab-nav">
							<button class="tab active"> {$t('posts.posts')}</button>
							<button class="tab"> {$t('posts.media')}</button>
							<button class="tab"> {$t('posts.likes')}</button>
						</nav>
					</div>

					<!-- Posts Feed -->
					<section class="posts-section" in:fly={{ y:200, duration: 300 }} out:fly={{ y: -200, duration: 200 }}>
						{#if $currentUser}
							<!-- Full post list for authenticated users -->
							{#if userPosts.length > 0}
{#each enhancedUserPosts as post (post._displayKey || post.id)}
  {#if post._isRepost}
    <RepostCard
      {post}
      repostedBy={{
        id: post.repostedBy_id,
        username: post.repostedBy_username,
        name: post.repostedBy_name,
        avatar: post.repostedBy_avatar
      }}
      on:interact={handlePostInteraction}
      on:comment={handleComment}
      on:quote={handleQuote}
    />
  {:else if post.quotedPost}
    <PostQuoteCard
      {post}
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

								<!-- FIXED: Loading trigger for authenticated users with more posts -->
								{#if profileHasMore}
									<div 
										id="profile-loading-trigger" 
										class="loading-trigger"
									>
										{#if profileLoadingMore}
											<div class="loading-trigger">							

											<div class="loading-indicator">
												<div class="trigger-loader" in:fly={{ y:50, duration: 300 }} out:fly={{ y: -50, duration: 200 }} ></div>
												<!-- <span>Loading more posts...</span> -->
											</div>
											</div>
										{:else}
												<div class="loading-trigger">							
													<div class="loading-indicator">
												<div class="trigger-loader" in:fly={{ y:50, duration: 300 }} out:fly={{ y: -50, duration: 200 }} ></div>
												<!-- <span>Loading more posts...</span> -->
												</div>
												</div>	
										{/if}
									</div>
								{:else if userPosts.length > 0}
									<div class="end-of-posts" style="text-center: center; padding: 20px; color: #666;">
										<p>No more posts to load</p>
										<p>Total posts: {userPosts.length}</p>
									</div>
								{/if}
							{:else}
								<div class="empty-state">
									<p>{user?.username || 'This user'} hasn't posted anything yet.</p>
								</div>
							{/if}
						{:else}
							<!-- Limited preview for non-authenticated users -->
							<div class="auth-required-posts">
								{#if userPosts.length > 0}
									<!-- Show just 2 posts as a preview -->
									{#each userPosts.slice(0, 2) as post (post.id)}
										<PostCard
											{post}
											isRepost={post.isRepost || false}
											isPreview={true}
											on:upvote={handlePostInteraction}
											on:downvote={handlePostInteraction}
											on:repost={handlePostInteraction}
											on:comment={handleComment}
											on:share={handlePostInteraction}
											on:quote={handleQuote}
											on:read={handlePostInteraction}
											on:follow={handleFollowUser}
										/>
									{/each}

									<!-- Authentication wall -->
									<div class="auth-wall">
										<div class="blur-overlay"></div>
										<div class="auth-prompt">
											<h3>
												{$t('posts.seeAll')}
												{totalPosts}
												{$t('posts.postsFrom')}
												{user?.name || user?.username}
											</h3>
											<p>{$t('posts.historySignin')}</p>
										</div>
									</div>
								{:else}
									<div class="empty-state">
										<p>{user?.username || 'This user'} hasn't posted anything yet.</p>
									</div>
								{/if}
							</div>
						{/if}
					</section>
				</main>
			</div>
		{/if}
	</div>

	{#if $showInput}
		<div class="dm-container" in:fly={{ y: 200, duration: 300 }} out:fly={{ y: 200, duration: 200 }} >
			<DMModule 
				bind:this={dmModule}
				user={data.user}
				initialConversationId={selectedUserId}
				height="80vh"
				showDrawerToggle={true}
			/>
		</div>
	{/if}

	{#if $showRightSidenav}
		<div class="sidebar-container">
			<PostTrends on:followUser={handleFollowUser} />
		</div>
	{/if}
</div>

<!-- FIXED: Debug panel with correct variable references -->
{#if browser}
<div style="position: fixed; bottom: 10px; left: 10px; background: #333; color: white; padding: 15px; font-size: 12px; z-index: 9999; border-radius: 8px; min-width: 250px; max-width: 300px;">
	<div style="font-weight: bold; margin-bottom: 8px;">🔄 Profile Scroll Debug</div>
	<div>Observer: {infiniteScrollManager ? '✅' : '❌'}</div>
	<div>Attached: {infiniteScrollManager?.isObserverAttached ? '✅' : '❌'}</div>
	<div>Trigger: {typeof document !== 'undefined' && document?.getElementById('profile-loading-trigger') ? '✅' : '❌'}</div>
	<div>Has More: {profileHasMore ? '✅' : '❌'}</div>
	<div>Loading: {profileLoadingMore ? '⏳' : '💤'}</div>
	<div>Posts: {userPosts.length}/{totalPosts}</div>
	<div>User: {$currentUser ? '✅' : '❌'}</div>
	<div style="margin-top: 10px;">
		<button 
			style="background: #007bff; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
			on:click={async () => {
				console.log('🚀 Manual trigger profile loadMore');
				await loadMoreProfilePosts();
			}}
		>
			Manual Load More
		</button>
	</div>
	<div style="margin-top: 5px;">
		<button 
			style="background: #28a745; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
			on:click={() => {
				console.log('🔧 Re-setup infinite scroll');
				setupInfiniteScroll();
				if (infiniteScrollManager) {
					infiniteScrollManager.attachWithRetry();
				}
			}}
		>
			Re-setup Scroll
		</button>
	</div>
</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	/* HTML: <div class="loader"></div> */
/* HTML: <div class="loader"></div> */

	/* New layout styles */
	.profile-page-container {
		display: flex;
		justify-content: center;
		min-height: 100vh;
		width: 100%;
		background-color: var(--primary-color);
	}

	.profile-page-container.hide-left-sidebar .profile-content-wrapper {
		margin-left: 0;
	}
	.loading-trigger {
		height: 100px !important;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		position: relative;
	}
	.sidebar-container {
		position: sticky;
		top: 0;
		height: 100vh;
	}
	.dm-container {
		position: absolute !important;
		bottom: 0;
		display: flex;
		width: 100%;
		max-width: 1000px;
		border-radius: 2rem;
		border: 1px solid var(--line-color);
		padding: 1rem;
		backdrop-filter: blur(10px);
	}
	.profile-content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		max-width: 800px;
	}

	/* Original styles preserved */
	.profile-sticky-header {
		position: sticky;
		top: 0;
		z-index: 10;
		height: 3rem;
		width: 100%;
		display: flex;
		align-items: center;
		background: var(--primary-color);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.back-button:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.header-username {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.username-text {
		font-weight: 600;
		font-size: 1rem;
		color: var(--text-color);
		line-height: 1.2;
	}

	.post-count {
		font-size: 0.8rem;
		color: var(--placeholder-color);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.error-container h1 {
		font-size: 2rem;
		color: var(--text-color);
		margin-bottom: 8px;
	}

	.error-container p {
		color: var(--placeholder-color);
		margin-bottom: 16px;
	}

	.main-wrapper {
		background: var(--bg-color);
		/* border-radius: 0.75rem; */
		width: 100%;
		margin-top: 0;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}
	.profile-header {
		background: var(--bg-color);
		overflow: hidden;
	}

	.profile-background {
		height: 200px;
		background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
	}

	.profile-info {
		padding: 0 1rem;
		position: relative;
	}

	.avatar-section {
		position: absolute;
		top: -60px;
		right: 24px;
	}

	.profile-avatar {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		border: 4px solid var(--bg-color);
		object-fit: cover;
	}

	.user-name {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-color);
		margin-bottom: 4px;
		margin-top: 0;
	}

	.username {
		color: var(--placeholder-color);
		font-size: 1.1rem;
		margin-bottom: 16px;
	}

	.user-bio {
		color: var(--text-color);
		line-height: 1.5;
		margin-bottom: 0.5rem;
	}

	.user-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 0.5rem;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--placeholder-color);
		font-size: 0.9rem;
	}

	.meta-item a {
		color: var(--primary-color);
		text-decoration: none;
	}

	.meta-item a:hover {
		text-decoration: underline;
	}

	.user-stats {
		display: flex;
		gap: 24px;
		margin-bottom: 0.5rem;
	}

	.stat {
		text-align: center;
	}

	.stat-number {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.stat-label {
		color: var(--placeholder-color);
		font-size: 0.9rem;
	}

	.action-buttons {
		display: flex;
		gap: 12px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: var(--primary-color);
		color: white;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		background: var(--secondary-color);
		color: white;
	}

	.btn-secondary:hover {
		opacity: 0.9;
	}

	.btn-outline {
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--line-color);
	}

	.btn-outline:hover {
		background: var(--line-color);
	}

	.profile-content {
		background: var(--bg-color);
		border-radius: 12px;
		overflow: hidden;
	}
	.loading-trigger {
		height: 200px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		margin-bottom: 100px !important;
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
	.tab-nav {
		display: flex;
		padding: 0 24px;
	}

	.tab {
		padding: 16px 20px;
		background: none;
		border: none;
		color: var(--placeholder-color);
		font-weight: 500;
		cursor: pointer;
		border-bottom: 3px solid transparent;
		transition: all 0.2s;
	}

	.tab.active {
		color: var(--primary-color);
		border-bottom-color: var(--primary-color);
	}

	.tab:hover {
		color: var(--text-color);
	}

	.posts-section {
		padding: 0 0.5rem;
		/* padding: 20px; */
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--placeholder-color);
	}
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		text-align: center;
		gap: 16px;
	}
	/* Mobile responsive */
	@media (max-width: 768px) {
		.profile-content-wrapper {
			padding: 1rem 0.5rem;
		}

		.main-wrapper {
			width: 100%;
			border-radius: 0.5rem;
		}

		.profile-info {
			padding: 16px;
		}

		.avatar-section {
			left: 16px;
		}

		.user-details {
			margin-top: 40px;
		}

		.profile-avatar {
			width: 80px;
			height: 80px;
		}

		.user-name {
			font-size: 1.5rem;
		}

		.action-buttons {
			flex-wrap: wrap;
		}

		.btn {
			flex: 1;
			justify-content: center;
		}
	}
</style>
