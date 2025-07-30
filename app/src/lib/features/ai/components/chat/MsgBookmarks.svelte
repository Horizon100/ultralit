<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import type { Messages, User, Threads } from '$lib/types/types';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
	import { MarkupFormatter } from '$lib/features/ai/utils/markupFormatter';

	let bookmarkedMessages: (Messages & { threadName?: string })[] = [];
	let isLoading = true;
	let threadLoading: Record<string, boolean> = {};
	let copyTooltips: Record<string, boolean> = {};

	const dispatch = createEventDispatcher();

	async function fetchBookmarkedMessages() {
		try {
			isLoading = true;
			const response = await fetch('/api/bookmarks');
			if (!response.ok) throw new Error('Failed to fetch bookmarks');
			bookmarkedMessages = await response.json();
		} catch (error) {
			console.error('Error fetching bookmarks:', error);
			bookmarkedMessages = [];
		} finally {
			isLoading = false;
		}
	}

	async function openThread(message: Messages) {
		try {
			if (!message.thread) {
				console.error('No thread ID associated with this message');
				return;
			}

			// Set loading state for this specific message
			threadLoading = { ...threadLoading, [message.id]: true };

			// Dispatch an event to the parent component to load the thread
			dispatch('loadThread', { threadId: message.thread });
		} catch (error) {
			console.error('Error opening thread:', error);
		} finally {
			// Clear loading state
			threadLoading = { ...threadLoading, [message.id]: false };
		}
	}

	async function copyMessage(message: Messages) {
		try {
			await MarkupFormatter.copyAsPlainText(message.text);

			// Show the tooltip for this message
			copyTooltips = { ...copyTooltips, [message.id]: true };

			// Hide the tooltip after 1 second
			setTimeout(() => {
				copyTooltips = { ...copyTooltips, [message.id]: false };
			}, 1000);
		} catch (error) {
			console.error('Error copying message:', error);
		}
	}

	onMount(() => {
		fetchBookmarkedMessages();
	});

	$: if ($currentUser?.bookmarks) {
		fetchBookmarkedMessages();
	}
</script>

{#if isLoading}
	<div class="spinner-container">
		<div class="spinner"></div>
	</div>
{:else if !bookmarkedMessages.length}
	<div class="empty-state">
		<p>No bookmarked messages yet</p>
		<p class="empty-state-detail">
			Bookmarks in user data: {$currentUser?.bookmarks?.join(', ')}
		</p>
	</div>
{:else}
	<div class="bookmark-container" transition:slide={{ duration: 200 }}>
		{#each bookmarkedMessages as message (message.id)}
			<div class="message-card">
				<div class="message-header">
					<div class="message-meta">
						<p class="message-author">
							{message.type === 'human' ? 'You' : 'Assistant'}
						</p>
						{#if message.threadName}
							<p class="message-thread-name">
								from {message.threadName}
							</p>
						{/if}
						<p class="message-date">
							{new Date(message.created).toLocaleDateString()}
						</p>
					</div>
					<div class="message-actions">
						<button
							class="action-button copy-button"
							on:click={() => copyMessage(message)}
							title="Copy to clipboard"
						>
							<Icon name="Copy" size={16} />
							{#if copyTooltips[message.id]}
								<span class="tooltip">Copied!</span>
							{/if}
						</button>

						{#if message.thread}
							<button
								class="action-button thread-button"
								on:click={() => openThread(message)}
								disabled={threadLoading[message.id]}
							>
								{#if threadLoading[message.id]}
									<span class="loading-spinner-small">
										<Icon name="Loader2" />
									</span>
								{:else}
									<Icon name="MessageSquare" size={16} />
									<span>Open Thread</span>
								{/if}
							</button>
						{/if}
					</div>
				</div>
				<div class="message-content">
					<p>{message.text}</p>
				</div>
				{#if message.attachments}
					<div class="message-attachments">
						<p>Has attachments</p>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	.loading-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		height: 100%;
	}

	.loading-spinner {
		height: 1.5rem;
		width: 1.5rem;
		color: var(--placeholder-color);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.empty-state {
		padding: 1rem;
		text-align: center;
		color: var(--placeholder-color);
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.empty-state-detail {
		font-size: 0.75rem;
		margin-top: 0.5rem;
		color: var(--secondary-color);
	}

	.bookmark-container {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: flex-end;
		width: 100%;
		margin-left: 0;
		margin-right: auto;
		margin-bottom: auto;
		overflow-y: auto;
		background-color: red;

		// padding: var(--spacing-sm);
		height: 50vh;
		overflow-y: auto;
		background-color: transparent;
		border-radius: 1rem;
	}

	.bookmark-container::-webkit-scrollbar {
		width: 8px;
	}

	.bookmark-container::-webkit-scrollbar-track {
		background: var(--primary-color);
		border-radius: 4px;
	}

	.bookmark-container::-webkit-scrollbar-thumb {
		background-color: var(--secondary-color);
		border-radius: 4px;
	}

	.message-card {
		border-radius: var(--radius-m);
		border: 1px solid var(--secondary-color);
		background: var(--primary-color);
		padding: 1rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: all 0.2s ease;
		width: 400px;
		height: 300px;
	}

	.message-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border-color: var(--tertiary-color);
		cursor: pointer;
	}

	.message-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--secondary-color);
		padding-bottom: 0.5rem;
	}

	.message-meta {
		display: flex;
		flex-direction: row;
		gap: 1rem;
	}

	.message-author {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--placeholder-color);
		margin: 0;
	}

	.message-thread-name {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--tertiary-color);
		margin: 0;
		border-left: 2px solid var(--tertiary-color);
		padding-left: 0.5rem;
	}
	.message-date {
		font-size: 0.75rem;
		color: var(--placeholder-color);
		margin: 0;
	}

	.thread-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		background-color: var(--bg-color);
		color: var(--text-color);
		border: none;
		border-radius: var(--radius-s);
		cursor: pointer;
		font-size: 0.75rem;
		transition: all 0.2s ease;
	}

	.thread-button:hover {
		background-color: var(--tertiary-color);
		color: var(--bg-color);
	}

	.thread-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.message-content {
		margin-top: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
		padding-right: 0.5rem;
		scrollbar-width: thin;
	}

	.message-content p {
		font-size: 1rem;
		line-height: 1.5;
		color: var(--text-color);
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message-attachments {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background-color: var(--bg-color);
		border-radius: var(--radius-s);
		width: fit-content;
	}

	.message-attachments p {
		font-size: 0.75rem;
		color: var(--tertiary-color);
		margin: 0;
	}

	.message-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.action-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background-color: var(--bg-color-tertiary);
		border: none;
		border-radius: var(--radius-s);
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		cursor: pointer;
		color: var(--text-color);
		transition: all 0.2s ease;
		position: relative;

		&:hover {
			background-color: var(--bg-color-quaternary);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	@media (max-width: 1000px) {
		.bookmark-container {
			display: flex;
			flex-wrap: nowrap;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			width: 100% !important;
			margin-left: 0;
			margin-right: auto;
			margin-bottom: auto;
			overflow-y: auto;
			background-color: red;

			// padding: var(--spacing-sm);
			height: 50vh;
			overflow-y: auto;
			overflow-x: hidden;
			background-color: transparent;
			border-radius: 1rem;
		}
		.message-card {
			margin-left: 4rem;
			width: calc(100% - 4rem);
		}
	}
</style>
