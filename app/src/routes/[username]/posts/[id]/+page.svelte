<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { pocketbaseUrl, currentUser } from '$lib/pocketbase';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import PostCard from '$lib/features/content/components/PostCard.svelte';
	import PostQuoteCard from '$lib/features/content/components/PostQuoteCard.svelte';
	import PostComposer from '$lib/features/content/components/PostComposer.svelte';
	import PostSidenav from '$lib/features/content/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/content/components/PostTrends.svelte';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { ArrowLeft, Loader2 } from 'lucide-svelte';
	// State
	let loading = true;
	let error = '';
	let post: any = null;
	let comments: any[] = [];
	let user: any = null;
	let showComposer = false;
	let innerWidth = 0;
	let showAuthModal = false;
	let authAction = '';

	// Get params from URL
	$: username = $page.params.username;
	$: postId = $page.params.id;

	async function fetchPostData() {
		if (!postId) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/posts/${postId}`);
			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to load post';
				return;
			}

			post = data.post;
			comments = data.comments;
			user = data.user;

			// Verify the username matches the post's author
			if (username && user.username !== username) {
				error = 'Post not found';
				return;
			}
		} catch (err) {
			console.error('Error fetching post data:', err);
			error = 'Failed to load post';
		} finally {
			loading = false;
		}
	}

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}

	// Handle post interactions - unified for all posts/comments
	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		if (!$currentUser) {
			alert($t('posts.interactPrompt'));
			return;
		}

		const { postId, action } = event.detail;
		console.log('Post interaction:', event.detail);

		try {
			let response;
			
			switch (action) {
				case 'upvote':
					response = await fetch(`/api/posts/${postId}/upvote`, {
						method: 'PATCH',
						credentials: 'include'
					});
					break;
				case 'repost':
					response = await fetch(`/api/posts/${postId}/repost`, {
						method: 'POST',
						credentials: 'include'
					});
					break;
				case 'share':
					response = await fetch(`/api/posts/${postId}/share`, {
						method: 'POST',
						credentials: 'include'
					});
					break;
				case 'read':
					response = await fetch(`/api/posts/${postId}/read`, {
						method: 'PATCH',
						credentials: 'include'
					});
					break;
			}

			if (!response || !response.ok) {
				const errorData = await response?.json().catch(() => ({}));
				throw new Error(errorData.message || `Failed to ${action} post`);
			}

			const result = await response.json();

			// Update local state based on the action
			if (action === 'upvote') {
				if (postId === post.id) {
					post.upvote = result.upvoted;
					post.upvoteCount = result.upvoteCount;
					post.downvoteCount = result.downvoteCount;
				} else {
					comments = comments.map(comment => {
						if (comment.id === postId) {
							return {
								...comment,
								upvote: result.upvoted,
								upvoteCount: result.upvoteCount,
								downvoteCount: result.downvoteCount
							};
						}
						return comment;
					});
				}
			} else if (action === 'repost') {
				if (postId === post.id) {
					post.repost = result.reposted;
					post.repostCount = result.repostCount;
				} else {
					comments = comments.map(comment => {
						if (comment.id === postId) {
							return {
								...comment,
								repost: result.reposted,
								repostCount: result.repostCount
							};
						}
						return comment;
					});
				}
			}

			console.log(`${action} successful for post ${postId}`);

		} catch (error) {
			console.error(`Error ${action}ing post:`, error);
			alert(`Failed to ${action} post: ` + (error instanceof Error ? error.message : 'Unknown error'));
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
		if (postId === post.id) {
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

		try {
			console.log('Creating quote post:', event.detail);

			const formData = new FormData();
			formData.append('content', event.detail.content);
			
			event.detail.attachments.forEach((file, index) => {
				formData.append(`attachment_${index}`, file);
			});

			const response = await fetch(`/api/posts/${event.detail.quotedPostId}/quote`, {
				method: 'POST',
				body: formData,
				credentials: 'include'
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to quote post');
			}

			const result = await response.json();
			console.log('Quote post created successfully:', result);
			
			// Optionally refresh or navigate
			// await fetchPostData();
			
		} catch (error) {
			console.error('Error quoting post:', error);
			alert('Failed to quote post: ' + (error instanceof Error ? error.message : 'Unknown error'));
		}
	}

	// Handle comment submission
	async function handleCommentSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>
	) {
		if (!$currentUser) {
			console.error($t('generic.userNotLoggedIn'));
			return;
		}

		try {
			const response = await fetch(`/api/posts/${post.id}/comments`, {
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

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to create comment');
			}

			const result = await response.json();
			
			if (result.success && result.comment) {
				comments = [...comments, result.comment];
				
				if (post) {
					post.commentCount = (post.commentCount || 0) + 1;
				}
				
				showComposer = false;
				console.log('Comment added successfully');
			}

		} catch (error) {
			console.error($t('posts.errorComment'), error);
			alert('Failed to add comment: ' + (error instanceof Error ? error.message : 'Unknown error'));
		}
	}

	function handleFollowUser(event: CustomEvent) {
		console.log($t('posts.followUser'), event.detail.userId);
	}

	$: replyPlaceholder = $t('posts.replyToThis') as string;

	onMount(() => {
		fetchPostData();
	});

	$: if (username && postId) {
		fetchPostData();
	}
</script>

<svelte:window bind:innerWidth />

<svelte:head>
	<title>{post ? `${user?.name || user?.username} - Post` : 'Post'}</title>
	<meta name="description" content={post ? post.content : 'View post details'} />
</svelte:head>

<div class="post-detail-container" class:hide-left-sidebar={!$showSidenav}>
	<!-- Left Sidebar Component -->
	{#if $showSidenav && innerWidth > 768}
		<div class="sidebar-container">
			<PostSidenav {innerWidth} />
		</div>
	{/if}

	<!-- Main Content -->
	<div class="post-content-wrapper">
		<!-- Header with back button -->
		<header class="post-header">
			<button class="back-button" on:click={goBack}>
				<ArrowLeft size={20} />
				<span>{$t('generic.back')}</span>
			</button>

			{#if user}
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
			{/if}
		</header>

		{#if loading}
			<div class="loading-container">
				<Loader2 class="loading-spinner" size={32} />
				<p>{$t('posts.loadingPosts')}</p>
			</div>
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

				<!-- Comment Composer -->
				{#if showComposer && $currentUser}
					<div class="comment-composer">
						<PostComposer
							parentId={post.id}
							placeholder={replyPlaceholder}
							on:submit={handleCommentSubmit}
						/>
					</div>
				{/if}

				<!-- Comments Section -->
				<section class="comments-section">
					<h3 class="comments-title">
						{comments.length > 0
							? `${comments.length} ${comments.length === 1 ? $t('posts.reply') : $t('posts.replies')}`
							: $t('posts.noReplies')}
					</h3>

					{#each comments as comment (comment.id)}
						{#if comment.quotedPost}
							<!-- This comment is a quote post -->
							<PostQuoteCard
								post={comment}
								on:interact={handlePostInteraction}
								on:comment={handleComment}
								on:quote={handleQuote}
							/>
						{:else}
							<!-- Regular comment -->
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
			</main>
		{/if}
	</div>

	<!-- Right Sidebar Component -->
	{#if innerWidth > 1200}
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
				<a href="/signup?redirect={encodeURIComponent($page.url.pathname)}" class="btn btn-secondary">
					{$t('profile.signup')}
				</a>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	/* Layout styles */
	.post-detail-container {
		display: flex;
		justify-content: center;
		min-height: 100vh;
		width: 100%;
		background-color: var(--primary-color);
	}

	.post-detail-container.hide-left-sidebar .post-content-wrapper {
		margin-left: 0;
	}

	.sidebar-container {
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.post-content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		max-width: 100%;
	}

	/* Header styles */
	.post-header {
		width: 100%;
		max-width: 680px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--line-color);
		margin-bottom: 1rem;
		position: sticky;
		top: 0;
		background-color: var(--bg-color);
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

	/* Post detail styles */
	.post-detail-main {
		width: 100%;
		max-width: 680px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
		margin-bottom: 1rem;
	}

	.comments-section {
		width: 100%;
	}

	.comments-title {
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--text-color);
		margin-bottom: 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--line-color);
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

	/* Mobile responsive */
	@media (max-width: 768px) {
		.post-content-wrapper {
			padding: 0.5rem;
		}

		.post-header {
			padding: 0.75rem;
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
