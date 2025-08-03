<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { PostWithInteractions, CommentWithInteractions } from '$lib/types/types.posts';
	import { currentUser } from '$lib/pocketbase'; // Import the current user store
	import { t } from '$lib/stores/translationStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let isOpen: boolean = false;
	export let post: PostWithInteractions | CommentWithInteractions | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		copyLink: void;
		quote: void;
	}>();

	function handleClose() {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleCopyLink() {
		dispatch('copyLink');
	}

	function handleQuote() {
		dispatch('quote');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && post}
	<div
		class="modal-backdrop"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Escape' && handleClose()}
		role="button"
		aria-label="Close modal"
		tabindex="0"
		transition:fade={{ duration: 200 }}
	>
		<div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="modal-header">
				<h2>{$t('generic.share')} {$t('posts.post')}</h2>
				<button class="close-button" on:click={handleClose}>
					<Icon name="X" size={20} />
				</button>
			</div>

			<div class="modal-body">
				<button class="share-option" on:click={handleCopyLink}>
					<div class="option-icon">
						<Icon name="Link" size={20} />
					</div>
					<div class="option-text">
						<div class="option-title">{$t('posts.copyLink')}</div>
						<div class="option-description">{$t('posts.shareLink')}</div>
					</div>
				</button>

				{#if $currentUser}
					<button class="share-option" on:click={handleQuote}>
						<div class="option-icon">
							<Icon name="Quote" size={20} />
						</div>
						<div class="option-text">
							<div class="option-title">{$t('posts.quote')} {$t('posts.post')}</div>
							<div class="option-description">{$t('posts.quoteDescription')}</div>
						</div>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
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
		max-width: 400px;
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
		padding: 16px;
	}

	.share-option {
		width: 100%;
		background: none;
		border: none;
		padding: 16px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		gap: 16px;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 8px;
	}

	.share-option:hover {
		background-color: var(--bg-gradient);
	}

	.share-option:last-child {
		margin-bottom: 0;
	}

	.option-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background-color: var(--bg-gradient);
		border-radius: 50%;
		color: var(--primary-color);
		flex-shrink: 0;
	}

	.option-text {
		flex: 1;
		text-align: left;
	}

	.option-title {
		color: var(--text-color);
		font-size: 16px;
		font-weight: 500;
		margin-bottom: 4px;
	}

	.option-description {
		color: var(--placeholder-color);
		font-size: 14px;
	}
</style>
