<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { sidenavStore, showSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { fade } from 'svelte/transition';
	import type { User, UserProfile, Threads, Messages } from '$lib/types/types'; // Removed PublicUserProfile
	import { postStore } from '$lib/stores/postStore';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	// Removed: import { getPublicUserProfile, getPublicUserProfiles } from '$lib/clients/profileClient';
	import { pocketbaseUrl, getPublicUserData, currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import PostComposer from '$lib/features/content/components/PostComposer.svelte';
	import PostCard from '$lib/features/content/components/PostCard.svelte';
	import PostCommentModal from '$lib/features/content/components/PostCommentModal.svelte';
	import RepostCard from '$lib/features/content/components/RepostCard.svelte';
	import PostQuoteCard from '$lib/features/content/components/PostQuoteCard.svelte';
	import PostSidenav from '$lib/features/content/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/content/components/PostTrends.svelte';
	import { X } from 'lucide-svelte';
	import { threadsStore, ThreadSortOption, showThreadList } from '$lib/stores/threadsStore';
	import { slide, fly } from 'svelte/transition';
	
	let showPostModal = false;
	let isCommentModalOpen = false;
	let selectedPost: PostWithInteractions | null = null;
	let innerWidth = 0;

	let userProfilesMap: Map<string, Partial<User> | null> = new Map();

	$: posts = $postStore.posts;
	$: loading = $postStore.loading;
	$: error = $postStore.error;

	$: userIds = [
		...new Set(
			posts.flatMap((post) => {
				const ids = [post.user];
				if (post.repostedBy && Array.isArray(post.repostedBy)) {
					ids.push(...post.repostedBy);
				}
				return ids;
			})
		)
	];

	$: enhancedPosts = posts.map((post) => {
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

	// Helper function to batch fetch user profiles using your existing function
	async function fetchUserProfiles(userIds: string[]): Promise<void> {
		const fetchPromises = userIds.map(async (userId) => {
			try {
				const profile = await getPublicUserData(userId);
				userProfilesMap.set(userId, profile);
			} catch (err) {
				console.error(`Error fetching profile for user ${userId}:`, err);
				userProfilesMap.set(userId, null);
			}
		});

		// Process in batches of 5 to avoid overwhelming the server
		const batchSize = 5;
		for (let i = 0; i < fetchPromises.length; i += batchSize) {
			const batch = fetchPromises.slice(i, i + batchSize);
			await Promise.all(batch);
		}

		// Force reactivity update
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

	// Handle creating a new post
	async function handlePostSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>
	) {
		try {
			await postStore.addPost(
				event.detail.content,
				event.detail.attachments,
				event.detail.parentId
			);
		} catch (err) {
			console.error('Error creating post:', err);
		}
	}

	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		const { postId, action } = event.detail;

		try {
			// Actions that require authentication
			if ((action === 'upvote' || action === 'repost' || action === 'read') && !$currentUser) {
				// Redirect to login or show login prompt
				alert('Please sign in to interact with posts');
				return;
			}

			// Process the actions
			if (action === 'upvote') {
				await postStore.toggleUpvote(postId);
			} else if (action === 'repost') {
				await postStore.toggleRepost(postId);
			} else if (action === 'read') {
				await postStore.markAsRead(postId);
			} else if (action === 'share') {
				// Share works for both logged-in and guest users
				await postStore.sharePost(postId);
			}
		} catch (err) {
			console.error(`Error ${action}ing post:`, err);
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
	) {
		const { content, attachments, parentId } = event.detail;

		if (!$currentUser) {
			console.error('User not logged in');
			return;
		}

		try {
			await postStore.addPost(content, attachments, parentId);

			// Close the modal after successful comment
			isCommentModalOpen = false;
			selectedPost = null;

			// Optionally refresh the posts to show the new comment
			await postStore.fetchPosts(20, 0);
		} catch (error) {
			console.error('Error posting comment:', error);
		}
	}

	async function handleQuote(event: CustomEvent) {
		if (!$currentUser) {
			// Redirect to login or show login prompt
			alert('Please sign in to quote posts');
			return;
		}

		const { content, attachments, quotedPostId } = event.detail;

		try {
			await postStore.quotePost(quotedPostId, content, attachments);
		} catch (error) {
			console.error('Failed to quote post:', error);
		}
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

	onMount(async () => {
		console.log('Home page mounted, showSidenav:', $showSidenav);

		// Fetch posts when component mounts
		if (posts.length === 0) {
			try {
				await postStore.fetchPosts(20, 0);
			} catch (err) {
				console.error('Error fetching posts:', err);
			}
		}
	});

	// When posts change, load any missing user profiles
	$: if (posts.length > 0 && userIds.length > 0) {
		const missingUserIds = userIds.filter((id) => !userProfilesMap.has(id));

		if (missingUserIds.length > 0) {
			fetchUserProfiles(missingUserIds).catch((err) => {
				console.error('Error fetching user profiles:', err);
			});
		}
	}

	// Reactive statements for debugging
	$: console.log('Sidenav visibility changed:', $showSidenav);
	$: console.log('Posts:', posts);
	$: console.log('Loading:', loading);
	$: console.log('Error:', error);
</script>

<svelte:window bind:innerWidth />

<div class="home-container" 
	class:hide-left-sidebar={!$showSidenav}
	class:drawer-visible={$showSidenav}

>
	<!-- Left Sidebar Component -->
	<PostSidenav {innerWidth} />

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
				<div class="loading-state">
					<p>{$t('posts.loadingPosts')}</p>
				</div>
			{/if}

			<!-- Posts Feed -->
			<section class="posts-feed">
				<h2 class="feed-title">{$t('posts.latestUpdates')}</h2>
				{#each enhancedPosts as post (post.id)}
					{#if post.repost}
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

				{#if posts.length === 0 && !loading}
					<div class="empty-state">
						<p>{$t('posts.noPosts')}</p>
					</div>
				{/if}
			</section>
			{#if $showSidenav && $currentUser}
				<div class="composer-overlay">
					<div class="composer-body" 			
						in:fly={{ y: 200, duration: 300 }}
						out:fly={{ y: 200, duration: 300 }}
					>

						<PostComposer on:submit={handlePostSubmit} />
					</div>
				</div>
			{/if}
		</div>
	</main>

	<!-- Right Sidebar Component -->
	{#if innerWidth > 1200}
		<PostTrends
		/>
	{/if}
</div>


<PostCommentModal
	isOpen={isCommentModalOpen && $currentUser !== null}
	post={selectedPost}
	on:close={handleCloseCommentModal}
	on:comment={handleCommentSubmit}
/>

<style lang="scss">

	@use "src/lib/styles/themes.scss" as *;	
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

	.drawer-visible.home-container {
		justify-content: space-between;
		

	}
	main {
		width: 100%;
		display: flex;
		
	}
	.main-content {
		flex: 1;
		padding: 0.5rem;
		max-width: 800px;
		width: 100%;
		overflow-y: auto;
		margin-bottom: 2rem;

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

	/* Mobile responsiveness */
	@media (max-width: 640px) {

	}
	@media (max-width: 768px) {
	main {
		width: 100%;
		display: flex;

	}

	}
</style>
