<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { 
		pocketbaseUrl, 
		currentUser, 
		getPublicUserData,
		getPublicUserByUsername,  // Add this import
		getPublicUsersBatch       // Add this import
	} from '$lib/pocketbase';
	import PostCard from '$lib/features/content/components/PostCard.svelte';
	import RepostCard from '$lib/features/content/components/RepostCard.svelte';
	import PostQuoteCard from '$lib/features/content/components/PostQuoteCard.svelte';
	import { postStore } from '$lib/stores/postStore';
	import PostSidenav from '$lib/features/content/components/PostSidenav.svelte';
	import PostTrends from '$lib/features/content/components/PostTrends.svelte';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';

	import {
		Calendar,
		MapPin,
		Link as LinkIcon,
		Mail,
		User,
		MessageSquare,
		Settings,
		Loader2,
		ArrowLeft
	} from 'lucide-svelte';

	// State
	let loading = true;
	let error = '';
	let user: any = null;
	let profile: any = null;
	let userPosts: any[] = [];
	let totalPosts = 0;
	let innerWidth = 0;
	let userProfilesMap: Map<string, any> = new Map();

	// Get username from URL
	$: username = $page.params.username;

	// Helper function to fetch user profiles (same as home page)
	async function fetchUserProfiles(userIds: string[]): Promise<void> {
		try {
			// Use batch endpoint for better performance
			const profiles = await getPublicUsersBatch(userIds);
			
			// Map profiles to userProfilesMap
			profiles.forEach((profile) => {
				if (profile && profile.id) {
					userProfilesMap.set(profile.id, profile);
				}
			});

			// For any missing profiles, mark as null
			userIds.forEach(id => {
				if (!userProfilesMap.has(id)) {
					userProfilesMap.set(id, null);
				}
			});

			// Force reactivity update
			userProfilesMap = new Map(userProfilesMap);
		} catch (error) {
			console.error('Error fetching user profiles:', error);
			
			// Fallback to individual requests if batch fails
			const fetchPromises = userIds.map(async (userId) => {
				try {
					const profile = await getPublicUserData(userId);
					userProfilesMap.set(userId, profile);
				} catch (err) {
					console.error(`Error fetching profile for user ${userId}:`, err);
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
	}

	async function fetchUserData() {
		if (!username) return;

		loading = true;
		error = '';

		try {
			// Use getPublicUserByUsername instead of getPublicUserData for username lookup
			const userData = await getPublicUserByUsername(username);
			
			if (!userData) {
				error = 'User not found';
				return;
			}

			user = userData;
			
			// Now fetch posts using the posts API, filtering by this user
			const response = await fetch(`/api/posts?limit=50&offset=0&user=${user.id}`);
			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Failed to load posts';
				return;
			}

			userPosts = data.posts || [];
			totalPosts = userPosts.length;

			// Get unique user IDs from posts for profile enhancement
			const userIds = [...new Set(userPosts.flatMap((post) => {
				const ids = [post.user];
				if (post.repostedBy && Array.isArray(post.repostedBy)) {
					ids.push(...post.repostedBy);
				}
				return ids;
			}))];

			// Fetch user profiles for enhancement
			if (userIds.length > 0) {
				await fetchUserProfiles(userIds);
			}

			// Enhance posts with user profile data (same as home page)
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
		}
	}

	function formatJoinDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long'
		});
	}

	// Handle post interactions (same as home page)
	async function handlePostInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		const { postId, action } = event.detail;

		if (!$currentUser && action !== 'share') {
			alert('Please sign in to interact with posts');
			return;
		}

		try {
			if (action === 'upvote') {
				await postStore.toggleUpvote(postId);
			} else if (action === 'repost') {
				await postStore.toggleRepost(postId);
			} else if (action === 'read') {
				await postStore.markAsRead(postId);
			} else if (action === 'share') {
				await postStore.sharePost(postId);
			}
		} catch (err) {
			console.error(`Error ${action}ing post:`, err);
		}
	}

	async function handleQuote(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		if (!$currentUser) {
			alert('Please sign in to quote posts');
			return;
		}

		const { content, attachments, quotedPostId } = event.detail;

		try {
			await postStore.quotePost(quotedPostId, content, attachments);
			// Refresh the user's posts to show the new quote
			await fetchUserData();
		} catch (error) {
			console.error('Failed to quote post:', error);
		}
	}

	// Handle post comments
	function handleComment(event: CustomEvent<{ postId: string }>) {
		if (!$currentUser) {
			alert($t('generic.interactPrompt'));
			return;
		}

		console.log($t('posts.addingComment'), event.detail.postId);
		// Implement comment handling here
	}

	function handleFollowUser(event: CustomEvent<{ userId: string }>) {
		console.log($t('posts.followUser'), event.detail.userId);
	}

	onMount(() => {
		fetchUserData();
	});

	// Refetch data when username changes
	$: if (username) {
		fetchUserData();
	}
</script>

<svelte:window bind:innerWidth />

<svelte:head>
	<title>{user?.name || user?.username || 'User'} - Profile</title>
	<meta name="description" content="Profile page for {user?.name || user?.username || 'User'}" />
</svelte:head>

<div class="profile-page-container" class:hide-left-sidebar={!$showSidenav}>
	<!-- Left Sidebar Component -->
	{#if $showSidenav && innerWidth > 768}
		<div class="sidebar-container">
			<PostSidenav {innerWidth} />
		</div>
	{/if}

	<!-- Main Content -->
	<div class="profile-content-wrapper">
		{#if loading}
			<div class="loading-container">
				<Loader2 class="loading-spinner" size={32} />
				<p>{$t('generic.loading')}</p>
			</div>
		{:else if error}
			<div class="error-container">
				<h1>{$t('posts.errorExpression')}</h1>
				<!-- <p>{error}</p> -->
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
				<button class="back-button" on:click={() => goto('/')}>
					<ArrowLeft size={20} />
				</button>
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
										<User size={16} />
										{$t('profile.follow')}
									</button>

									<button class="btn btn-outline">
										<Settings size={16} />
									</button>
								{:else}
									<button class="btn btn-primary" on:click={() => goto('/login')}>
										<User size={16} />
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
					<!-- <section class="posts-section">
            {#if $postStore.posts.length > 0}
              {#each $postStore.posts as post (post.id)}
                {#if post.isRepost}
                  <RepostCard 
                    {post}
                    repostedBy={{
                      id: post.repostedBy_id || user.id,
                      username: post.repostedBy_username || user.username,
                      name: post.repostedBy_name || user.name,
                      avatar: post.repostedBy_avatar || user.avatar
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
                    isRepost={false}
                    on:interact={handlePostInteraction}
                    on:comment={handleComment}
                    on:quote={handleQuote}
                  />
                {/if}
              {/each}
            {:else}
              <div class="empty-state">
                <p>No posts yet</p>
              </div>
            {/if}
          </section> -->
					<!-- Posts Feed -->
					<section class="posts-section">
						{#if $currentUser}
							<!-- Full post list for authenticated users -->
							{#if $postStore.posts.length > 0}
								{#each $postStore.posts as post (post.id)}
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
											isRepost={false}
											on:interact={handlePostInteraction}
											on:comment={handleComment}
											on:quote={handleQuote}
										/>
									{/if}
								{/each}
							{:else}
								<div class="empty-state">
									<p>{$t('posts.noPosts')}</p>
								</div>
							{/if}
						{:else}
							<!-- Limited preview for non-authenticated users -->
							<div class="auth-required-posts">
								{#if $postStore.posts.length > 0}
									<!-- Show just 2 posts as a preview -->
									{#each $postStore.posts.slice(0, 2) as post (post.id)}
										<PostCard
											{post}
											isRepost={false}
											isPreview={true}
											on:interact={handlePostInteraction}
											on:comment={handleComment}
											on:quote={handleQuote}
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
												{user.name || user.username}
											</h3>
											<p>{$t('posts.historySignin')}</p>
											<div class="auth-buttons">
												<a href="/signup?ref=profile&username={username}" class="btn btn-primary"
													>Sign Up</a
												>
												<a
													href="/login?redirect={encodeURIComponent($page.url.pathname)}"
													class="btn btn-secondary">Log In</a
												>
											</div>
										</div>
									</div>
								{:else}
									<div class="empty-state">
										<p>{$t('posts.noPosts')}</p>
									</div>
								{/if}
							</div>
						{/if}
					</section>
				</main>
			</div>
		{/if}
	</div>

	<!-- Right Sidebar Component -->
	{#if innerWidth > 1200}
		<div class="sidebar-container">
			<PostTrends on:followUser={handleFollowUser} />
		</div>
	{/if}
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
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

	.sidebar-container {
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.profile-content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
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

	.back-button {
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		margin-right: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
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
