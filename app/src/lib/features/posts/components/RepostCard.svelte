<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import { pocketbaseUrl } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	import type { User } from '$lib/types/types';

	export let post: PostWithInteractions;
	export let repostedBy: {
		id?: string;
		username?: string;
		name?: string;
		avatar?: string;
	} | null = null;

	const dispatch = createEventDispatcher<{
		interact: { postId: string; action: 'upvote' | 'repost' | 'share' | 'read' };
		comment: { postId: string };
	}>();

	function handleInteract(
		event: CustomEvent<{ postId: string; action: 'upvote' | 'repost' | 'share' | 'read' }>
	) {
		dispatch('interact', event.detail);
	}

	function handleComment(event: CustomEvent<{ postId: string }>) {
		dispatch('comment', event.detail);
	}

	$: repostCount = post.repostCount || 0;
	$: upvoteCount = post.upvoteCount || 0;
	$: shareCount = post.shareCount || 0;
	$: commentCount = post.commentCount || 0;
</script>

{#if repostedBy && repostedBy.id}
	<article class="repost-wrapper">
		<!-- Repost header -->
		<div class="repost-header">
			<a href="/{repostedBy.username || repostedBy.id}" class="reposter-link">
				<!-- Use the same avatar endpoint as your layout -->
				<img
					src="/api/users/{repostedBy.id}/avatar"
					alt="{repostedBy.name || repostedBy.username || 'User'}'s avatar"
					class="reposter-avatar"
				/>
			</a>
			<Icon name="Repeat" size={16} />
			<a href="/{repostedBy.username || repostedBy.id}" class="reposter-name">
				{repostedBy.name || repostedBy.username || 'User'}
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
{/if}

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
