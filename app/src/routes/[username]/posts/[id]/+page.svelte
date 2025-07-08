<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { currentUser } from '$lib/pocketbase';
import { isPDFReaderOpen } from '$lib/stores/pdfReaderStore';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import PostQuoteCard from '$lib/features/posts/components/PostQuoteCard.svelte';
	import PostComposer from '$lib/features/posts/components/PostComposer.svelte';
	import PostSidenav from '$lib/features/posts/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/posts/components/PostTrends.svelte';
	import { showSidenav, showRightSidenav, showSettings, showInput } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import BackButton from '$lib/components/buttons/BackButton.svelte';
	import { postStore } from '$lib/stores/postStore';
	import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type { User } from '$lib/types/types';
	import type {
		Post,
		PostWithInteractions,
		Comment,
		CommentWithInteractions,
		UpvoteResponse,
		RepostResponse,
		MarkAsReadResponse,
		QuotePostResponse,
		PostUpdateData
	} from '$lib/types/types.posts';
import { pocketbaseUrl } from '$lib/stores/pocketbase'; // Adjust import path as needed

	// State
	let loading = true;
	let error = '';
	let post: PostWithInteractions | null = null;
	let comments: CommentWithInteractions[] = [];
	let user: User | null = null;
	let showComposer = false;
	let showAuthModal = false;
	let authAction = '';
	let postCardElement: HTMLElement;
	let commentsElement: HTMLElement;
	let isScrollingIntoComments = false;
	let commentSubmitted = false;
	let lastCommentTime = 0;
	let mounted = false;

	let scrollY = 0;
	let isScrolled = false;

	const SCROLL_THRESHOLD = 100;

	$: {
		isScrolled = scrollY > SCROLL_THRESHOLD;
		// console.log('Scroll update:', { scrollY, isScrolled, threshold: SCROLL_THRESHOLD });
	}
	$: username = $page.params.username;
	$: postId = $page.params.id;

	async function fetchPostData() {
		if (!postId) return;

		const result = await clientTryCatch(
			(async () => {
				loading = true;
				error = '';

				const fetchResult = await fetchTryCatch<{
					post: PostWithInteractions;
					comments: CommentWithInteractions[];
					user: User;
					error?: string;
				}>(`/api/posts/${postId}`);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to load post: ${fetchResult.error}`);
				}

				const data = fetchResult.data;

				if (data.error) {
					throw new Error(data.error);
				}

				// Ensure we have the required data
				if (!data.post) {
					throw new Error('Post not found');
				}

				if (!data.user) {
					throw new Error('Post author not found');
				}

				post = data.post;
				comments = data.comments || [];
				user = data.user;

				// Verify the username matches the post's author (only if username is provided in URL)
				if (username && user && user.username !== username) {
					throw new Error('Post not found');
				}

				return { post, comments, user };
			})(),
			`Fetching post data for ${postId}`
		);

		if (isFailure(result)) {
			console.error('Error fetching post data:', result.error);
			error = result.error;
			// Reset state on error
			post = null;
			comments = [];
			user = null;
		}

		loading = false;
	}

	// Handle scroll detection
let showPDFReader = false;
let currentPDFUrl = '';

function openPDFReader(attachmentData) {
	currentPDFUrl = `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachmentData.id}/${attachmentData.file_path}`;
	showPDFReader = true;
	isPDFReaderOpen.set(true); // Set global state
}

function closePDFReader() {
	showPDFReader = false;
	currentPDFUrl = '';
	isPDFReaderOpen.set(false); // Reset global state
	// Ensure body scroll is restored (backup)
	document.body.style.overflow = '';
}

function getPDFUrl(attachmentData) {
	return `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachmentData.id}/${attachmentData.file_path}`;
}

function handleScroll() {
	// Don't handle scroll when PDF reader is open
	if ($isPDFReaderOpen) return;
	
	if (!postCardElement || !commentsElement) return;

	const scrollTop = window.pageYOffset;
	const commentsRect = commentsElement.getBoundingClientRect();
	const windowHeight = window.innerHeight;

	// Check if comments section is taking up significant screen space
	const commentsVisibleHeight = Math.max(
		0,
		Math.min(commentsRect.bottom, windowHeight) - Math.max(commentsRect.top, 0)
	);
	const commentsVisible = commentsVisibleHeight > windowHeight * 0.4; // 40% of screen

	if (commentsVisible && !isScrollingIntoComments) {
		// Scale down when entering comments
		isScrollingIntoComments = true;
		postCardElement.style.transform = 'scale(0.9)';
		postCardElement.style.transformOrigin = 'center top';
	} else if (!commentsVisible && isScrollingIntoComments) {
		// Scale back up when leaving comments
		isScrollingIntoComments = false;
		postCardElement.style.transform = 'scale(1)';
	}
}

	let scrollTimeout: number;
	function throttledScroll() {
		if (scrollTimeout) return;

		scrollTimeout = requestAnimationFrame(() => {
			handleScroll();
			scrollTimeout = 0;
		});
	}

	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		if (!$currentUser) {
			alert($t('posts.interactPrompt'));
			return;
		}

		const { postId, action } = event.detail;

		// Extract real post ID if it's a composite key (for consistency with home page)
		const realPostId = extractRealPostId(postId);

		console.log('Post detail interaction:', {
			receivedPostId: postId,
			realPostId,
			action,
			isCompositeKey: postId !== realPostId
		});

		const result = await clientTryCatch(
			(async () => {
				let fetchResult;
				let optimisticUpdate = null;

				// Apply optimistic updates first for better UX
				if (action === 'upvote') {
					optimisticUpdate = applyOptimisticUpvote(realPostId);
				} else if (action === 'repost') {
					optimisticUpdate = applyOptimisticRepost(realPostId);
				}

				try {
					switch (action) {
						case 'upvote': {
							fetchResult = await fetchTryCatch<UpvoteResponse>(`/api/posts/${realPostId}/upvote`, {
								method: 'PATCH',
								credentials: 'include'
							});

							if (isFailure(fetchResult)) {
								throw new Error(`Failed to upvote post: ${fetchResult.error}`);
							}

							const upvoteData = fetchResult.data;
							updatePostState(realPostId, 'upvote', upvoteData);
							break;
						}

						case 'repost': {
							fetchResult = await fetchTryCatch<RepostResponse>(`/api/posts/${realPostId}/repost`, {
								method: 'POST',
								credentials: 'include'
							});

							if (isFailure(fetchResult)) {
								throw new Error(`Failed to repost: ${fetchResult.error}`);
							}

							const repostData = fetchResult.data;
							updatePostState(realPostId, 'repost', repostData);
							break;
						}

						case 'share': {
							// Use the postStore method for consistency
							const shareResult = await postStore.sharePost(realPostId, post?.author_username);

							// Handle share result similar to home page
							if (shareResult.copied) {
								console.log('Link copied to clipboard!');
							}
							break;
						}

						case 'read': {
							await postStore.markAsRead(realPostId);
							updatePostState(realPostId, 'read', { hasRead: true });
							break;
						}
					}

					console.log(`${action} successful for post ${realPostId}`);
					return true;
				} catch (error) {
					// Revert optimistic updates on error
					if (optimisticUpdate) {
						revertOptimisticUpdate(optimisticUpdate);
					}
					throw error;
				}
			})(),
			`Handling ${action} interaction for post ${realPostId}`
		);

		if (isFailure(result)) {
			console.error(`Error ${action}ing post:`, result.error);
			alert(`Failed to ${action} post: ${result.error}`);
		}
	}

	// Helper function to extract real post ID (same as home page)
	function extractRealPostId(postId: string): string {
		if (postId.startsWith('repost_')) {
			const parts = postId.split('_');
			if (parts.length >= 2) {
				return parts[1];
			}
		}
		return postId;
	}

	function applyOptimisticUpvote(postId: string) {
		const originalState = {
			post: post ? ({ ...post } as PostWithInteractions) : null,
			comments: [...comments]
		};

		if (postId === post?.id && post) {
			post = {
				...post,
				upvote: !post.upvote,
				upvoteCount: post.upvote ? (post.upvoteCount || 1) - 1 : (post.upvoteCount || 0) + 1,
				downvote: false // Remove downvote when upvoting
			};
		} else {
			comments = comments.map((comment) => {
				if (comment.id === postId) {
					return {
						...comment,
						upvote: !comment.upvote,
						upvoteCount: comment.upvote
							? (comment.upvoteCount || 1) - 1
							: (comment.upvoteCount || 0) + 1,
						downvote: false
					};
				}
				return comment;
			});
		}

		return originalState;
	}

	function applyOptimisticRepost(postId: string) {
		const originalState = {
			post: post ? ({ ...post } as PostWithInteractions) : null,
			comments: [...comments]
		};

		if (postId === post?.id && post) {
			post = {
				...post,
				repost: !post.repost,
				repostCount: post.repost ? (post.repostCount || 1) - 1 : (post.repostCount || 0) + 1
			};
		} else {
			comments = comments.map((comment) => {
				if (comment.id === postId) {
					return {
						...comment,
						repost: !comment.repost,
						repostCount: comment.repost
							? (comment.repostCount || 1) - 1
							: (comment.repostCount || 0) + 1
					};
				}
				return comment;
			});
		}

		return originalState;
	}

	function revertOptimisticUpdate(originalState: {
		post: PostWithInteractions | null;
		comments: CommentWithInteractions[];
	}) {
		post = originalState.post;
		comments = originalState.comments;
	}

	function updatePostState(postId: string, action: string, data: PostUpdateData) {
		if (action === 'upvote') {
			const upvoteData = data as Pick<UpvoteResponse, 'upvoted' | 'upvoteCount' | 'downvoteCount'>;
			if (postId === post?.id) {
				post = {
					...post,
					upvote: upvoteData.upvoted,
					upvoteCount: upvoteData.upvoteCount,
					downvote: upvoteData.upvoted ? false : post.downvote,
					downvoteCount: upvoteData.downvoteCount || post.downvoteCount
				};
			} else {
				comments = comments.map((comment) => {
					if (comment.id === postId) {
						return {
							...comment,
							upvote: upvoteData.upvoted,
							upvoteCount: upvoteData.upvoteCount,
							downvote: upvoteData.upvoted ? false : comment.downvote,
							downvoteCount: upvoteData.downvoteCount || comment.downvoteCount
						};
					}
					return comment;
				});
			}
		} else if (action === 'repost') {
			const repostData = data as Pick<RepostResponse, 'reposted' | 'repostCount'>;
			if (postId === post?.id) {
				post = {
					...post,
					repost: repostData.reposted,
					repostCount: repostData.repostCount
				};
			} else {
				comments = comments.map((comment) => {
					if (comment.id === postId) {
						return {
							...comment,
							repost: repostData.reposted,
							repostCount: repostData.repostCount
						};
					}
					return comment;
				});
			}
		} else if (action === 'read') {
			const readData = data as Pick<MarkAsReadResponse, 'hasRead'>;
			if (postId === post?.id) {
				post = {
					...post,
					hasRead: readData.hasRead
				};
			}
		}
	}
	// Handle comment button clicks
	function handleComment(event: CustomEvent<{ postId: string }>) {
		const { postId } = event.detail;

		if (!$currentUser) {
			showAuthModal = true;
			authAction = 'comment';
			return;
		}

		// If it's the main post, show composer
		if (postId === post?.id) {
			showComposer = !showComposer;
		} else {
			// For comments, you could navigate to that comment or show a modal
			console.log('Comment on comment:', postId);
		}
	}

	// Handle quote submissions
	async function handleQuote(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		if (!$currentUser) {
			alert($t('posts.interactPrompt'));
			return;
		}

		const result = await clientTryCatch(
			(async () => {
				console.log('Creating quote post:', event.detail);

				const formData = new FormData();
				formData.append('content', event.detail.content);

				event.detail.attachments.forEach((file, index) => {
					formData.append(`attachment_${index}`, file);
				});

				const fetchResult = await fetchTryCatch<QuotePostResponse>(
					`/api/posts/${event.detail.quotedPostId}/quote`,
					{
						method: 'POST',
						body: formData,
						credentials: 'include'
					}
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to quote post: ${fetchResult.error}`);
				}

				const result = fetchResult.data;
				console.log('Quote post created successfully:', result);

				/*
				 * Optionally refresh or navigate
				 * await fetchPostData();
				 */

				return result;
			})(),
			`Creating quote for post ${event.detail.quotedPostId}`
		);

		if (isFailure(result)) {
			console.error('Error quoting post:', result.error);
			alert(`Failed to quote post: ${result.error}`);
		}
	}
	$: if (mounted && username && postId) {
		console.log('🔄 Reactive fetchPostData triggered by username/postId change');
		// Check if we just added a comment - if so, don't refetch
		if (Date.now() - lastCommentTime < 5000) {
			console.log('⏸️ Skipping fetchPostData - comment was just added');
		} else {
			console.log('📡 Fetching post data...');
			fetchPostData();
		}
	}

	$: if (comments && commentSubmitted) {
		console.log('🔄 Comments array updated, count:', comments.length);
		// Reset flag after a brief delay to avoid infinite loops
		setTimeout(() => {
			commentSubmitted = false;
		}, 100);
	}
	$: if (comments) {
		console.log('📊 Comments array changed. Length:', comments.length);
		console.log(
			'📝 Comment IDs:',
			comments.map((c) => c.id)
		);
	}

	async function handleCommentSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>
	) {
		if (!$currentUser) {
			console.error($t('generic.userNotLoggedIn'));
			return;
		}

		// Add null check for post
		if (!post) {
			console.error('No post available for commenting');
			return;
		}

		console.log('🚀 Starting comment submission...');

		const result = await clientTryCatch(
			(async () => {
				const fetchResult = await fetchTryCatch<{
					success: boolean;
					comment: CommentWithInteractions;
					message?: string;
				}>(`/api/posts/${post.id}/comments`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						content: event.detail.content,
						user: $currentUser.id
					}),
					credentials: 'include'
				});

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to create comment: ${fetchResult.error}`);
				}

				const result = fetchResult.data;

				if (result.success && result.comment) {
					console.log('📝 New comment received from API:', result.comment);

					// Set timestamp to prevent reactive fetchPostData
					lastCommentTime = Date.now();
					commentSubmitted = true;

					// Ensure we don't have duplicates
					const existingIds = new Set(comments.map((c) => c.id));
					if (!existingIds.has(result.comment.id)) {
						// Force array reactivity by creating completely new array
						const newComments = [...comments, result.comment];
						comments = newComments;
						console.log('✅ Comment added to array. New length:', comments.length);
					} else {
						console.log('⚠️ Comment already exists in array');
					}

					// Update post count - add null check
					if (post) {
						post = {
							...post,
							commentCount: (post.commentCount || 0) + 1
						};
						console.log('📈 Updated post comment count:', post.commentCount);
					}

					showComposer = false;

					// Reset flag after delay
					setTimeout(() => {
						commentSubmitted = false;
					}, 1000);
				}

				return result;
			})(),
			`Creating comment for post ${post.id}`
		);

		if (isFailure(result)) {
			console.error($t('posts.errorComment'), result.error);
			alert(`Failed to add comment: ${result.error}`);
		}
	}
	function handleFollowUser(event: CustomEvent) {
		console.log($t('posts.followUser'), event.detail.userId);
	}

	$: replyPlaceholder = $t('posts.replyToThis') as string;

	$: if (post && $currentUser && !loading && post.user !== $currentUser.id && !post.hasRead) {
		setTimeout(async () => {
			// Add additional null check inside timeout
			if (!post) return;

			const result = await clientTryCatch(
				(async () => {
					await postStore.markAsRead(post.id);

					// Update local post state
					const fetchResult = await fetchTryCatch<{ post: PostWithInteractions }>(
						`/api/posts/${post.id}`
					);

					if (isFailure(fetchResult)) {
						throw new Error(`Failed to fetch updated post: ${fetchResult.error}`);
					}

					const data = fetchResult.data;
					post = data.post;

					return data;
				})(),
				`Marking post ${post.id} as read`
			);

			if (isFailure(result)) {
				console.error('Error marking post as read:', result.error);
			}
		}, 2000);
	}

onMount(() => {
	console.log('🏗️ Component mounted');
	mounted = true; 

	const checkScrollableElements = () => {
		const elements = [
			document.documentElement,
			document.body,
			document.querySelector('.post-content-wrapper'),
			document.querySelector('.main-wrapper'),
			document.querySelector('.post-content')
		];

		elements.forEach((el, index) => {
			if (el) {
				console.log(`Element ${index}:`, {
					element: el.className || el.tagName,
					scrollTop: el.scrollTop,
					scrollHeight: el.scrollHeight,
					clientHeight: el.clientHeight,
					isScrollable: el.scrollHeight > el.clientHeight
				});
			}
		});
	};

	// Check initially and on scroll
	checkScrollableElements();

	// Enhanced scroll handler with PDF reader isolation
	const scrollHandler = (e: Event) => {
		// Don't handle scroll when PDF reader is open
		if ($isPDFReaderOpen) return;

		const target = e.target as HTMLElement;
		scrollY = target.scrollTop;
	};

	// Enhanced document scroll handler with PDF reader check
	const handleDocumentScroll = (e: Event) => {
		// Don't handle scroll when PDF reader is open
		if ($isPDFReaderOpen) return;
		
		handleScroll(); // Your existing handleScroll function
	};

	// Add scroll listeners with PDF reader isolation
	document.addEventListener('scroll', scrollHandler, true); // Use capture phase
	document.addEventListener('scroll', handleDocumentScroll);
	document.querySelector('.post-content-wrapper')?.addEventListener('scroll', scrollHandler);
	document.querySelector('.main-wrapper')?.addEventListener('scroll', scrollHandler);

	// Enhanced intersection observer with PDF reader check
	setTimeout(() => {
		if (commentsElement && postCardElement) {
			const observer = new IntersectionObserver(
				(entries) => {
					// Don't handle intersection when PDF reader is open
					if ($isPDFReaderOpen) return;

					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							// Comments are visible - scale down post
							postCardElement.style.transform = 'scale(0.9)';
							postCardElement.style.transition = 'transform 0.4s ease';
							postCardElement.style.transformOrigin = 'center top';
						} else {
							// Comments not visible - scale back up
							postCardElement.style.transform = 'scale(1)';
						}
					});
				},
				{
					threshold: 0.3 // Trigger when 30% of comments are visible
				}
			);

			observer.observe(commentsElement);

			// Enhanced cleanup function
			return () => {
				observer.disconnect();
				document.removeEventListener('scroll', scrollHandler, true);
				document.removeEventListener('scroll', handleDocumentScroll);
				document.querySelector('.post-content-wrapper')?.removeEventListener('scroll', scrollHandler);
				document.querySelector('.main-wrapper')?.removeEventListener('scroll', scrollHandler);
			};
		}
	}, 100);
});
</script>


<svelte:window bind:scrollY />

<svelte:head>
	<title>{post ? `${user?.name || user?.username} - Post` : 'Post'}</title>
	<meta name="description" content={post ? post.content : 'View post details'} />
</svelte:head>

<div
	class="post-detail-container"
	class:hide-left-sidebar={!$showSidenav}
	class:nav-visible={$showSettings}
	in:fly={{ y: 50, duration: 300 }}
	out:fly={{ y: -50, duration: 200 }}
>
	<!-- Left Sidebar Component -->
	{#if $showSidenav}
		<div class="sidebar-container">
			<PostSidenav />
		</div>
	{/if}

	<!-- Main Content -->
	<div
		class="post-content-wrapper"
		class:nav-visible={$showSettings}
		in:fly={{ y: 50, duration: 300 }}
		out:fly={{ y: -50, duration: 200 }}
	>
		<!-- Header with back button -->
		<header class="post-header">
			<!-- {#if user}
				<div class="header-user">
					<img
						src={user.avatar
							? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
							: '/api/placeholder/32/32'}
						alt="{user.name || user.username}'s avatar"
						class="header-avatar"
					/>
					<span class="header-username">@{user.username}</span>
				</div>
			{:else if loading}
				<div class="skeleton-header">
					<div class="skeleton-avatar skeleton-shimmer"></div>
					<div class="skeleton-text-group">
						<div class="skeleton-text skeleton-text-username skeleton-shimmer"></div>
					</div>
				</div>
			{/if} -->
		</header>

		{#if loading}
			<!-- Main post skeleton -->
			<div class="skeleton-post">
				<div class="skeleton-post-header">
					<div class="skeleton-avatar skeleton-shimmer"></div>
					<div class="skeleton-text-group">
						<div class="skeleton-text skeleton-text-name skeleton-shimmer"></div>
						<div class="skeleton-text skeleton-text-username skeleton-shimmer"></div>
					</div>
				</div>

				<div class="skeleton-content">
					<div class="skeleton-text skeleton-text-line skeleton-shimmer"></div>
					<div class="skeleton-text skeleton-text-line skeleton-shimmer"></div>
					<div class="skeleton-text skeleton-text-line skeleton-text-short skeleton-shimmer"></div>
				</div>

				<div class="skeleton-actions"></div>
			</div>

			<!-- Comments skeleton -->
			<!-- <div class="skeleton-comments">
				<div class="skeleton-text skeleton-text-title skeleton-shimmer"></div>
				
				{#each Array(3) as _, i}
					<div class="skeleton-comment">
						<div class="skeleton-avatar skeleton-shimmer"></div>
						<div class="skeleton-comment-content">
							<div class="skeleton-text skeleton-text-name skeleton-shimmer"></div>
							<div class="skeleton-text skeleton-text-line skeleton-shimmer"></div>
							<div class="skeleton-text skeleton-text-line skeleton-text-short skeleton-shimmer"></div>
						</div>
					</div>
				{/each}
			</div> -->
		{:else if error}
			<div class="error-container">
				<h1>{$t('posts.errorExpression')}</h1>
				<p>{error}</p>
				<button class="btn btn-primary" on:click={() => goto('/')}>
					{$t('generic.returnHome')}
				</button>
			</div>
		{:else if post}
			<main class="post-detail-main">
				<div class="comments-header">
					<BackButton />
					<h3 class="comments-title">
						{comments.length > 0
							? `${comments.length} ${comments.length === 1 ? $t('posts.reply') : $t('posts.replies')}`
							: $t('posts.noReplies')}
					</h3>
				</div>
					<div
						bind:this={postCardElement}
						class="post-card-container"
						in:fly={{ y: -50, duration: 300 }}
						out:fly={{ y: -50, duration: 200 }}
					>
						{#if post.quotedPost}
							<PostQuoteCard
								{post}
								on:interact={handlePostInteraction}
								on:comment={handleComment}
								on:quote={handleQuote}
							/>
						{:else}
							<PostCard
								{post}
								showActions={true}
								isPreview={false}
								on:interact={handlePostInteraction}
								on:comment={handleComment}
								on:quote={handleQuote}
							/>
						{/if}
					</div>

				<!-- Comment Composer -->
				{#if $showInput && $currentUser}
					<div
						class="comment-composer"
						in:fly={{ y: -50, duration: 300 }}
						out:fly={{ y: -50, duration: 200 }}
					>
						<PostComposer
							parentId={post.id}
							placeholder={replyPlaceholder}
							on:submit={handleCommentSubmit}
						/>
					</div>
				{/if}

				<!-- Comments Section -->
				{#if comments && comments.length > 0}
					<section
						class="comments-section"
						class:scrolled={isScrolled}
						bind:this={commentsElement}
						in:fly={{ y: 200, duration: 300 }}
						out:fly={{ y: 200, duration: 200 }}
					>
						{#each comments as comment (comment.id)}
							{#if comment.quotedPost}
								<PostQuoteCard
									post={comment}
									on:interact={handlePostInteraction}
									on:comment={handleComment}
									on:quote={handleQuote}
								/>
							{:else}
								<PostCard
									post={comment}
									showActions={true}
									isComment={true}
									on:interact={handlePostInteraction}
									on:comment={handleComment}
									on:quote={handleQuote}
								/>
							{/if}
						{/each}
					</section>
				{/if}
			</main>
		{/if}
	</div>

	{#if $showRightSidenav}
		<div class="sidebar-container">
			<PostTrends on:followUser={handleFollowUser} />
		</div>
	{/if}
</div>

{#if showAuthModal}
	<div class="auth-modal">
		<div class="auth-modal-content">
			<button class="close-button" on:click={() => (showAuthModal = false)}>×</button>

			<h3>{$t('posts.joinConversation')}</h3>
			<p>
				{$t('generic.signInTo')}
				{authAction === 'comment' ? 'comment on' : 'interact with'}
				{$t('generic.this')}
				{$t('posts.post')}
			</p>
			<div class="auth-buttons">
				<a href="/login?redirect={encodeURIComponent($page.url.pathname)}" class="btn btn-primary">
					{$t('profile.login')}
				</a>
				<a
					href="/signup?redirect={encodeURIComponent($page.url.pathname)}"
					class="btn btn-secondary"
				>
					{$t('profile.signup')}
				</a>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	main {
		transition: all 0.3s ease;
	}
	/* Layout styles */
	.post-detail-container {
		display: flex;
		justify-content: center;
		min-height: 100vh;
		width: 100%;
		background-color: var(--primary-color);
		transition: all 0.3s ease;
	}
	// .post-detail-container.nav-visible .post-content-wrapper {
	// 	left: 3rem;
	// 	width: 50%;
	// 	transition: all 0.3s ease;
	// 	& .post-detail-main {
	// 		margin-left: 5rem !important;
	// 		padding: 0 0.5rem;
	// 	}
	// }
	// .post-detail-container.hide-left-sidebar .post-content-wrapper {
	// 	margin-left: 0;
	// }

	.sidebar-container {
		position: sticky;
		top: 0;
		height: 100vh;
		display: flex;
	}

	.post-content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		max-width: calc(100% - 2rem);
		transition: all 0.3s ease;
	}

	/* Header styles */
	.post-header {
		width: 100%;
		max-width: 800px;
		display: flex;
		align-items: center;
		justify-content: left;

		position: relative;
		left: 0;
		z-index: 10;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: background-color 0.2s;
	}

	.back-button:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.header-user {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
	}

	.header-username {
		font-weight: 600;
		color: var(--text-color);
	}

	/* Loading and error states */
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		width: 100%;
		max-width: 680px;
		text-align: center;
		padding: 2rem;
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
		font-size: 1.5rem;
		color: var(--text-color);
		margin-bottom: 0.5rem;
	}

	.error-container p {
		color: var(--placeholder-color);
		margin-bottom: 1.5rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
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

	.back-btn {
		position: fixed;
		top: 10vh;
		left: 0;
		width: 60px;
		height: 3rem;
		background-color: red;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Post detail styles */
	.post-detail-main {
		width: 100%;
		max-width: 800px;
		height: calc(100% - 2rem);
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: stretch;
		gap: 0;
	}

	.main-post {
		background-color: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.post-author {
		margin-bottom: 1rem;
	}

	.author-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: inherit;
	}

	.author-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
	}

	.author-name {
		font-weight: 600;
		color: var(--text-color);
	}

	.author-username {
		font-size: 0.9rem;
		color: var(--placeholder-color);
	}

	.post-content {
		font-size: 1.1rem;
		line-height: 1.5;
		color: var(--text-color);
		margin-bottom: 1rem;
	}

	.post-metadata {
		margin-top: 1rem;
		padding-top: 1rem;
		/* border-top: 1px solid var(--line-color); */
		font-size: 0.9rem;
		color: var(--placeholder-color);
	}

	.post-actions {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
		padding-top: 1rem;
		/* border-top: 1px solid var(--line-color); */
	}

	.action-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.action-button:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.action-button.comment:hover {
		color: var(--primary-color);
	}

	.action-button.repost:hover {
		color: #2ecc71;
	}

	.action-button.upvote:hover {
		color: #e74c3c;
	}

	/* Comment styles */
	.comment-composer {
		width: 100%;
	}

	.comments-section {
		width: auto;
		height: 100%;
		margin-left: 0;
		background: var(--bg-gradient);
		padding: 0.5rem 1rem;
		border-radius: 2rem;
		margin-bottom: 2rem;
		scroll-behavior: smooth;
		overflow-y: auto !important;
		box-shadow: 0 30px 140px 50px rgba(255, 255, 255, 0.22);
		overflow-x: hidden;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}

	.comments-header {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0;
		margin: 0;
	}

	.comments-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-color);
		padding: 0;
		margin: 0;
	}

	.auth-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.auth-modal-content {
		background-color: var(--bg-color);
		border-radius: 12px;
		padding: 2rem;
		max-width: 400px;
		width: 90%;
		text-align: center;
		position: relative;
	}

	.close-button {
		position: absolute;
		top: 10px;
		right: 10px;
		font-size: 1.5rem;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-color);
	}

	.auth-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--primary-color);
		color: var(--primary-color);
	}
	/* Skeleton Loading Styles */
	.skeleton-container {
		width: 100%;
		max-width: 680px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.skeleton-shimmer {
		position: relative;
		overflow: hidden;
		background: linear-gradient(
			90deg,
			var(--skeleton-base, #f0f0f0) 25%,
			var(--skeleton-highlight, #e0e0e0) 50%,
			var(--skeleton-base, #f0f0f0) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 2s infinite;
	}

	@media (prefers-color-scheme: dark) {
		.skeleton-shimmer {
			background: linear-gradient(
				90deg,
				var(--skeleton-base, #2a2a2a) 25%,
				var(--skeleton-highlight, #3a3a3a) 50%,
				var(--skeleton-base, #2a2a2a) 75%
			);
		}
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	/* Header Skeleton - matches .header-user */
	.skeleton-header {
		display: flex;
		align-items: center;
		gap: 0.5rem; /* Same as .header-user */
	}

	.skeleton-header .skeleton-avatar {
		width: 32px; /* Same as .header-avatar */
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Post Skeleton - matches .main-post */
	.skeleton-post {
		background-color: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 1.5rem; /* Same as .main-post */
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 680px;
	}

	.skeleton-post-header {
		display: flex;
		align-items: center;
		gap: 0.75rem; /* Same as .author-link */
		margin-bottom: 1rem; /* Same as .post-author */
	}

	.skeleton-post-header .skeleton-avatar {
		width: 48px; /* Same as .author-avatar */
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.skeleton-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem; /* Same as .post-content */
	}

	.skeleton-actions {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem; /* Same as .post-actions */
		padding-top: 1rem;
		border-top: 1px solid var(--line-color);
	}

	/* Comments Skeleton - matches .comments-section */
	.skeleton-comments {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.skeleton-comment {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		background-color: var(--bg-color);
	}

	.skeleton-comment .skeleton-avatar {
		width: 48px; /* Same as comment avatars */
		height: 48px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.skeleton-comment-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Skeleton Elements */
	.skeleton-text {
		height: 16px;
		border-radius: 4px;
	}

	.skeleton-text-name {
		width: 120px;
		height: 18px; /* Matches font-weight: 600 text */
	}

	.skeleton-text-username {
		width: 80px;
		height: 14px; /* Matches smaller username text */
	}

	.skeleton-text-title {
		width: 150px;
		height: 20px; /* Matches .comments-title */
		margin-bottom: 0.5rem;
	}

	.skeleton-text-line {
		width: 100%;
		height: 18px; /* Matches post content line-height */
	}

	.skeleton-text-short {
		width: 60%;
	}

	.skeleton-text-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.skeleton-action {
		width: 60px;
		height: 32px; /* Matches action button height */
		border-radius: 8px; /* Same as .action-button */
	}
	.post-card-container {
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
		background:none;
	}
	/* Dark mode adjustments */
	:global([data-theme='dark']) .skeleton-shimmer {
		--skeleton-base: #2a2a2a;
		--skeleton-highlight: #3a3a3a;
	}

	:global([data-theme='light']) .skeleton-shimmer {
		--skeleton-base: #f0f0f0;
		--skeleton-highlight: #e0e0e0;
	}

	@media (max-width: 1000px) {
		.post-detail-main {
			padding: 0;
		}
	}
	@media (max-width: 768px) {
		.post-card-container {
			transition: transform 0.25s ease-out;
		}
		.skeleton-container {
			padding: 0.5rem;
		}

		.skeleton-post {
			padding: 1rem;
		}

		.skeleton-header .skeleton-avatar {
			width: 28px;
			height: 28px;
		}

		/* Post skeleton mobile adjustments */
		.skeleton-post-header .skeleton-avatar {
			width: 40px;
			height: 40px;
		}

		.skeleton-comment .skeleton-avatar {
			width: 40px;
			height: 40px;
		}

		.skeleton-text-name {
			width: 100px;
		}

		.skeleton-text-username {
			width: 70px;
		}

		.skeleton-text-line {
			height: 16px;
		}

		.skeleton-actions {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.skeleton-action {
			width: 50px;
			height: 28px;
		}

		.post-content-wrapper {
			padding: 0.5rem;
		}

		.back-button span {
			display: none;
		}

		.main-post {
			padding: 1rem;
		}

		.post-content {
			font-size: 1rem;
		}

		.post-actions {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.action-button {
			font-size: 0.9rem;
		}
	}
</style>
