<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { PostWithInteractions, PostAttachment } from '$lib/types/types.posts';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import PostComposer from '$lib/features/posts/components//PostComposer.svelte';
	import { X } from 'lucide-svelte';

	export let isOpen: boolean = false;
	export let post: PostWithInteractions | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		quote: { content: string; attachments: File[]; quotedPostId: string };
	}>();

	function handleClose() {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleQuoteSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; parentId?: string }>
	) {
		if (!post) return;

		// Get attachments from the event - PostComposer already sends File[]
		const attachments = event.detail.attachments || [];

		dispatch('quote', {
			content: event.detail.content,
			attachments,
			quotedPostId: post.id
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="modal-backdrop"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		transition:fade={{ duration: 200 }}
	>
		<div class="modal-content" transition:scale={{ duration: 200, start: 0.9 }}>
			<header class="modal-header">
				<h2>Quote Post</h2>
				<button type="button" class="close-button" on:click={handleClose}>
					<X size={20} />
				</button>
			</header>

			<div class="modal-body">
				{#if post}
					<div class="quoted-post">
						<PostCard {post} showActions={false} isPreview={true} />
					</div>

					<div class="composer-section">
						<PostComposer
							placeholder="Add your comment..."
							buttonText="Quote Post"
							on:submit={handleQuoteSubmit}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--bg-color);
		border-radius: 12px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid var(--line-color);
	}

	.modal-header h2 {
		color: var(--text-color);
		font-size: 18px;
		font-weight: 600;
		margin: 0;
	}

	.close-button {
		background: none;
		border: none;
		padding: 8px;
		border-radius: 6px;
		color: var(--placeholder-color);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-button:hover {
		background-color: var(--bg-gradient);
		color: var(--text-color);
	}

	.modal-body {
		padding: 20px;
		max-height: calc(90vh - 80px);
		overflow-y: auto;
	}

	.quote-section {
		margin-bottom: 20px;
	}

	.quoted-post {
		// border: 1px solid var(--line-color);
		border-radius: 8px;
		overflow: hidden;
		height: 10rem;
	}

	/* Scrollbar styling */
	.modal-body::-webkit-scrollbar {
		width: 6px;
	}

	.modal-body::-webkit-scrollbar-track {
		background: var(--bg-gradient);
	}

	.modal-body::-webkit-scrollbar-thumb {
		background: var(--line-color);
		border-radius: 3px;
	}

	.modal-body::-webkit-scrollbar-thumb:hover {
		background: var(--placeholder-color);
	}
	.modal-body :global(.post-card) {
		margin-bottom: 0;
		border: none !important;
	}
</style>
