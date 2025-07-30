<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { PostWithInteractions, PostAttachment } from '$lib/types/types.posts';
	import PostCard from '$lib/features/posts/components/PostCard.svelte';
	import PostComposer from './PostComposer.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let isOpen: boolean = false;
	export let post: PostWithInteractions | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		comment: { content: string; attachments: File[]; parentId: string };
	}>();

	function handleClose() {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleCommentSubmit(
		event: CustomEvent<{
			content: string;
			attachments?: File[] | FileList | null;
			parentId?: string;
		}>
	) {
		console.log('🔥🔥🔥 MODAL COMMENT SUBMIT - START');
		console.log('📝 Raw event detail:', event.detail);
		console.log('📋 Post:', post);
		console.log('📊 Event type:', event.type);
		console.log('📊 Event constructor:', event.constructor.name);

		if (!post) {
			console.error('❌ No post available');
			return;
		}

		let attachments: File[] = [];
		const eventAttachments = event.detail.attachments;

		if (eventAttachments) {
			if (eventAttachments instanceof FileList) {
				attachments = Array.from(eventAttachments);
			} else if (Array.isArray(eventAttachments)) {
				attachments = eventAttachments;
			} else {
				attachments = [eventAttachments as File];
			}
		}

		const commentData = {
			content: event.detail.content,
			attachments,
			parentId: post.id
		};

		console.log('📤 About to dispatch comment event with:', commentData);
		console.log('📤 Dispatch function exists:', typeof dispatch);

		try {
			dispatch('comment', commentData);
			console.log('✅ Comment event dispatched successfully');
		} catch (error) {
			console.error('❌ Error dispatching comment event:', error);
		}

		console.log('🔥🔥🔥 MODAL COMMENT SUBMIT - END');
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
				<h2>Reply to Post</h2>
				<button class="close-button" on:click={handleClose}>
					<Icon name="X" size={20} />
				</button>
			</div>

			<div class="modal-body">
				<!-- Original Post (without actions) -->
				<div class="original-post">
					<PostCard {post} showActions={false} />
				</div>

				<!-- Reply Composer -->
				<div class="reply-section">
					<PostComposer
						placeholder="Post your reply..."
						buttonText="Reply"
						parentId={post.id}
						on:submit={handleCommentSubmit}
					/>
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
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
	.original-post {
		margin-bottom: 20px;
	}

	.reply-section {
		// border-top: 1px solid var(--line-color);
		padding-top: 20px;
	}
	.modal-body {
		padding: 20px;
		max-height: calc(90vh - 80px);
		overflow-y: auto;
	}

	.modal-body :global(.post-card) {
		margin-bottom: 0;
		border: none;
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
</style>
