<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import { pocketbaseUrl } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let post: any;
	export let repostedBy: any;

	const dispatch = createEventDispatcher();

	function handleInteract(event: any) {
		dispatch('interact', event.detail);
	}

	function handleComment(event: any) {
		dispatch('comment', event.detail);
	}
	$: repostCount = post.repostCount || 0;
$: upvoteCount = post.upvoteCount || 0;
$: shareCount = post.shareCount || 0;
$: commentCount = post.commentCount || 0;
</script>

<article class="repost-wrapper">
	<!-- Repost header -->
	<div class="repost-header">
		<a href="/{repostedBy.username}" class="reposter-link">
			<img
				src={repostedBy.avatar
					? `${pocketbaseUrl}/api/files/users/${repostedBy.id}/${repostedBy.avatar}`
					: ''}
				alt="{repostedBy.name || repostedBy.username}'s avatar"
				class="reposter-avatar"
			/>
		</a>
		{@html getIcon('Repeat', { size: 16 })}
		<a href="/{repostedBy.username}" class="reposter-name">
			{repostedBy.name || repostedBy.username}
			{$t('posts.reposted')}
		</a>
	</div>

	<!-- Original post -->
	<PostCard
		{post}
		showActions={true}
		isRepost={false}
		on:interact={handleInteract}
		on:comment={handleComment}
	/>
</article>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.repost-wrapper {
		margin-bottom: 1rem;
		border-radius: 12px;
		overflow: hidden;

		// border: 1px solid var(--line-color);
	}

	.repost-header {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--placeholder-color);
		font-size: 0.9rem;
		padding: 12px 16px 8px;
		background: rgba(var(--secondary-color-rgb), 0.05);
		// border-bottom: 1px solid var(--line-color);
	}

	.reposter-link {
		text-decoration: none;
	}

	.reposter-avatar {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		object-fit: cover;
	}

	.reposter-name {
		color: var(--placeholder-color);
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s;
	}

	.reposter-name:hover {
		color: var(--text-color);
	}

	.repost-wrapper :global(.post-card) {
		margin-bottom: 0;
		margin-left: 1rem;
		padding-left: 1rem;
		border-radius: 1rem;
		border-top: none;
		background: rgba(0, 0, 0, 0.2);

		border: 1px solid var(--line-color);
	}
</style>
