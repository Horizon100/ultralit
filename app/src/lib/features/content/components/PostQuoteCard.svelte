<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	import { pocketbaseUrl, currentUser } from '$lib/pocketbase';
	import PostCard from '$lib/features/content/components/PostCard.svelte';
	import { Quote } from 'lucide-svelte';
	import { postStore } from '$lib/stores/postStore';
	import { t } from '$lib/stores/translationStore';

	export let post: PostWithInteractions;
	export let quotedBy: {
		id?: string;
		username?: string;
		name?: string;
		avatar?: string;
	} = {};

	let quotedPost: PostWithInteractions | null = null;
	let loadingQuotedPost = true;

	const dispatch = createEventDispatcher<{
		interact: { postId: string; action: 'upvote' | 'repost' | 'read' | 'share' };
		comment: { postId: string };
		quote: { content: string; attachments: File[]; quotedPostId: string };
	}>();

	async function fetchQuotedPost() {
		if (!post.quotedPost) {
			loadingQuotedPost = false;
			return;
		}

		try {
			console.log('Fetching quoted post:', post.quotedPost);

			// Fetch the specific quoted post directly
			const response = await fetch(`/api/posts/${post.quotedPost}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				if (response.status === 404) {
					console.log('Quoted post not found (404)');
					quotedPost = null;
				} else {
					throw new Error(`Failed to fetch quoted post: ${response.status}`);
				}
			} else {
				const data = await response.json();
				console.log('Quoted post data received:', data);
				
				// The API returns { post, comments, user } structure
				if (data.post) {
					quotedPost = data.post;
					console.log('Quoted post loaded successfully');
				} else {
					console.log('No post data in response');
					quotedPost = null;
				}
			}
		} catch (error) {
			console.error('Error fetching quoted post:', error);
			quotedPost = null;
		} finally {
			loadingQuotedPost = false;
		}
	}

	function handleInteraction(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'read' | 'share' }>
	) {
		dispatch('interact', event.detail);
	}

	function handleComment(event: CustomEvent<{ postId: string }>) {
		dispatch('comment', event.detail);
	}

	function handleQuote(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		dispatch('quote', event.detail);
	}

	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		// If less than an hour, show minutes
		if (minutes < 60) return `${minutes}m`;
		
		// If less than a day, show hours
		if (hours < 24) return `${hours}h`;
		
		// If more than a day, show date format
		const day = date.getDate();
		const month = date.getMonth(); // 0-11
		const year = date.getFullYear();
		const currentYear = now.getFullYear();
		
		// Month names array for translation lookup
		const monthKeys = [
			'january', 'february', 'march', 'april', 'may', 'june',
			'july', 'august', 'september', 'october', 'november', 'december'
		];
		
		const monthName = $t(`months.${monthKeys[month]}`) as string;
		
		// If same year, show: "15. March"
		if (year === currentYear) {
			return `${day}. ${monthName}`;
		}
		
		// If different year, show: "15. March 2023"
		return `${day}. ${monthName} ${year}`;
	}

	onMount(() => {
		fetchQuotedPost();
	});
</script>

<div class="quote-card">
	<!-- Quote header showing who quoted -->
	<div class="quote-header">
		<Quote size={14} />
		<span>{$t('posts.quotedBy')} {quotedBy.name || quotedBy.username || 'Unknown User'}</span>
	</div>

	<!-- Quote author and content -->
	<div class="quote-author-section">
		<div class="quote-author-info">
			<a href="/{post.author_username}" class="avatar-link">
				<img
					src={post.author_avatar
						? `${pocketbaseUrl}/api/files/users/${post.user}/${post.author_avatar}`
						: '/api/placeholder/40/40'}
					alt="{post.author_username || post.author_name}'s avatar"
					class="quote-author-avatar"
				/>
			</a>
			<div class="quote-author-meta">
				<a href="/{post.author_username}" class="author-link">
					<div class="quote-author-name">
						{post.author_name || post.author_username || 'Unknown User'}
					</div>
				</a>
				<div class="quote-timestamp">{formatTimestamp(post.created)}</div>
			</div>
		</div>

		<!-- Quote content -->
		{#if post.content}
			<div class="quote-content">
				<p>{post.content}</p>
			</div>
		{/if}
	</div>

	<!-- Quoted post -->
	{#if loadingQuotedPost}
		<div class="quoted-post loading">
			<p>{$t('generic.loading')}</p>
		</div>
	{:else if quotedPost}
		<div class="quoted-post">
			<PostCard
				post={quotedPost}
				showActions={false}
				isPreview={true}
				on:interact={handleInteraction}
				on:comment={handleComment}
				on:quote={handleQuote}
			/>
		</div>
	{:else}
		<div class="quoted-post error">
			<p>{$t('posts.quoteNotAvailable')}</p>
		</div>
	{/if}

	<!-- Quote actions (for the quote post itself, not the quoted post) -->
	<div class="quote-actions">
		<PostCard
			{post}
			showActions={true}
			isQuote={true}
			on:interact={handleInteraction}
			on:comment={handleComment}
			on:quote={handleQuote}
		/>
	</div>
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;
	* {
		font-family: var(--font-family);
	}

	.quote-card {
		border-top: 1px solid var(--line-color);
		border-bottom: 1px solid var(--line-color);
		overflow: hidden;
		transition: all 0.15s ease;
	}



	.quote-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px 8px;
		color: var(--placeholder-color);
		font-size: 14px;
	}


	.quote-author-info {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.quote-author-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
	}

	.quote-author-meta {
		flex: 1;
	}

	.quote-author-name {
		font-weight: 600;
		color: var(--text-color);
		font-size: 15px;
	}

	.quote-timestamp {
		color: var(--placeholder-color);
		font-size: 14px;
	}

	.author-link {
		text-decoration: none;
	}

	.author-link:hover .quote-author-name {
		text-decoration: underline;
	}

	.avatar-link {
		text-decoration: none;
	}

	.quote-content {
		color: var(--text-color);
		font-size: 15px;
		line-height: 1.5;
		margin-left: 1rem;
	}

	.quote-content p {
		margin: 0;
	}

	.quoted-post {
		margin-top: 1rem;
		margin-left: 1rem;
		// border: 1px solid var(--line-color);
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--line-color) !important;
	}

	.quoted-post.loading,
	.quoted-post.error {
		padding: 16px;
		text-align: center;
		color: var(--placeholder-color);
		background: var(--bg-gradient);
	}



	/* Hide the post content from the actions PostCard since we're showing it above */
	.quote-actions :global(.post-content) {
		display: none;
	}

	.quote-actions :global(.post-header) {
		display: none;
	}

	.quote-card :global(.post-card) {
		margin-bottom: 0;
		margin-left: 1rem;
		border: 1px solid transparent;
	}
</style>
