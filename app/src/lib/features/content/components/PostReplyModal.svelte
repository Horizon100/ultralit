<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	import PostCard from '../../../components/cards/PostCard.svelte';
	import PostComposer from './PostComposer.svelte';
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
		event: CustomEvent<{ content: string; attachments?: File[] | FileList | null }>
	) {
		if (!post) return;

		let attachments: File[] = [];
		if (event.detail.attachments) {
			if (event.detail.attachments instanceof FileList) {
				attachments = Array.from(event.detail.attachments);
			} else if (Array.isArray(event.detail.attachments)) {
				attachments = event.detail.attachments;
			} else if (event.detail.attachments instanceof File) {
				attachments = [event.detail.attachments];
			}
		}

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

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && post}
	<div class="modal-backdrop" on:click={handleBackdropClick} transition:fade={{ duration: 200 }}>
		<div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="modal-header">
				<h2>Quote Post</h2>
				<button class="close-button" on:click={handleClose}>
					<X size={20} />
				</button>
			</div>

			<div class="modal-body">
				<!-- Quote Composer -->
				<div class="quote-section">
					<PostComposer
						placeholder="What do you think about this post?"
						buttonText="Quote Post"
						on:submit={handleQuoteSubmit}
					/>
				</div>

				<!-- Quoted Post (without actions, in a card style) -->
				<div class="quoted-post">
					<PostCard {post} showActions={false} />
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use "src/lib/styles/themes.scss" as *;
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
