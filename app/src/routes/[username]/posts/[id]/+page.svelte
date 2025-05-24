<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { pocketbaseUrl, currentUser } from '$lib/pocketbase';
	import PostCard from '$lib/components/cards/PostCard.svelte';
	import PostComposer from '$lib/features/content/components/PostComposer.svelte';
	import PostSidenav from '$lib/features/content/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/content/components/PostTrends.svelte';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { ArrowLeft, MessageSquare, Heart, Repeat, Share, Loader2 } from 'lucide-svelte';

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

	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function goBack() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}

	// Handle post interactions
	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		if (!$currentUser) {
			// Redirect to login or show login prompt
			alert($t('posts.interactPrompt'));
			return;
		}

		console.log('Post interaction:', event.detail);
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
			// Add comment logic here - you might want to use your postStore
			console.log($t('posts.addingComment'), event.detail);

			// Refresh comments after adding
			await fetchPostData();
			showComposer = false;
		} catch (error) {
			console.error($t('posts.errorComment'), error);
		}
	}

	function handleFollowUser(event) {
		console.log($t('posts.followUser'), event.detail.userId);
		// You can implement additional logic here if needed
	}

	onMount(() => {
		fetchPostData();
	});

	// Refetch data when params change
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
				<span>{$t('generic.back')} </span>
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
				<!-- Main Post -->
				<article class="main-post">
					<div class="post-author">
						<a href="/{user.username}" class="author-link">
							<img
								src={user.avatar
									? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
									: '/api/placeholder/48/48'}
								alt="{user.name || user.username}'s avatar"
								class="author-avatar"
							/>
							<div class="author-info">
								<div class="author-name">{user.name || user.username}</div>
								<div class="author-username">@{user.username}</div>
							</div>
						</a>
					</div>

					<div class="post-content">
						<p>{post.content}</p>

						{#if post.attachments && post.attachments.length > 0}
							<div class="post-attachments">
								{#each post.attachments as attachment}
									<div class="attachment">
										{#if attachment.file_type === 'image'}
											<img
												src="/api/files/posts/{attachment.id}/{attachment.file_path}"
												alt={attachment.original_name}
												class="attachment-image"
											/>
										{:else}
											<div class="attachment-file">
												<span>{attachment.original_name}</span>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="post-metadata">
						<span class="post-time">{formatTimestamp(post.created)}</span>
					</div>

					<div class="post-actions">
						<button
							class="action-button comment"
							on:click={() => {
								if (!$currentUser) {
									// Update to show auth modal instead of alert
									showAuthModal = true;
									authAction = 'comment';
									return;
								}
								showComposer = !showComposer;
							}}
						>
							<MessageSquare size={20} />
							<span
								>{comments.length}
								{comments.length === 1 ? $t('posts.reply') : $t('posts.replies')}</span
							>
						</button>

						<button
							class="action-button repost"
							on:click={() =>
								handlePostInteraction(
									new CustomEvent('interact', { detail: { postId: post.id, action: 'repost' } })
								)}
						>
							<Repeat size={20} />
							<span>{post.repostCount || 0}</span>
						</button>

						<button
							class="action-button upvote"
							on:click={() =>
								handlePostInteraction(
									new CustomEvent('interact', { detail: { postId: post.id, action: 'upvote' } })
								)}
						>
							<Heart size={20} />
							<span>{post.upvoteCount || 0}</span>
						</button>

						<button class="action-button share">
							<Share size={20} />
						</button>
					</div>
				</article>

				<!-- Comment Composer -->
				{#if showComposer && $currentUser}
					<div class="comment-composer">
						<PostComposer
							parentId={post.id}
							placeholder={$t('posts.replyToThis')}
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
						<PostCard
							post={comment}
							showActions={true}
							isComment={true}
							on:interact={handlePostInteraction}
						/>
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
				<a href="/login?redirect={encodeURIComponent($page.url.pathname)}" class="btn btn-primary"
					>{$t('profile.login')}</a
				>
				<a
					href="/signup?redirect={encodeURIComponent($page.url.pathname)}"
					class="btn btn-secondary">{$t('profile.signup')}</a
				>
			</div>
		</div>
	</div>
{/if}

<style>
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

	.loading-spinner {
		animation: spin 1s linear infinite;
		color: var(--primary-color);
		margin-bottom: 1rem;
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

	.post-attachments {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
	}

	.attachment-image {
		width: 100%;
		border-radius: 8px;
		object-fit: cover;
	}

	.attachment-file {
		padding: 1rem;
		background-color: rgba(var(--primary-color), 0.1);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
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
