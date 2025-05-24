<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import type { InternalChatMessage, Messages, User } from '$lib/types/types';
	import { Bookmark, Copy, MessageSquare, ListTodo, CheckCircle } from 'lucide-svelte';
	import type { SvelteComponentTyped } from 'svelte';
	import { MarkupFormatter } from '$lib/features/ai/utils/markupFormatter';

	export let message: InternalChatMessage;
	export let userId: string;

	export let isDualResponse: boolean = false;
	export let isPrimaryDualResponse: boolean = false;

	const dispatch = createEventDispatcher();
	let showCopiedTooltip = false;
	let showBookmarkTooltip = false;
	let bookmarkTooltipText = '';
	let isBookmarkedState = false;
	let showTaskTooltip = false;
	let taskTooltipText = '';
	let showSelectionTooltip = false;
	let selectionTooltipText = '';

	// Define type for Lucide icons
	type IconComponent = SvelteComponentTyped<{
		size?: number | string;
		color?: string;
		strokeWidth?: number | string;
		class?: string;
	}>;

	type Reaction = {
		symbol:
			| typeof Bookmark
			| typeof Copy
			| typeof MessageSquare
			| typeof ListTodo
			| typeof CheckCircle;
		action: string;
		label: string;
		isIcon: boolean;
		showCondition?: () => boolean;
	};

	// Updated reactions array with the new task button
	const reactions: Reaction[] = [
		{
			symbol: Bookmark,
			action: 'bookmark',
			label: 'Bookmark',
			isIcon: true,
			showCondition: () => !isDualResponse
		},
		{
			symbol: Copy,
			action: 'copy',
			label: 'Copy to Clipboard',
			isIcon: true
		},
		{
			symbol: MessageSquare,
			action: 'reply',
			label: 'Reply to message',
			isIcon: true,
			showCondition: () => !isDualResponse
		},
		{
			symbol: ListTodo,
			action: 'task',
			label: 'Create task from message',
			isIcon: true,
			showCondition: () => !isDualResponse
		},
		{
			symbol: CheckCircle,
			action: 'selectResponse',
			label: 'Select this response',
			isIcon: true,
			showCondition: () => isDualResponse
		}
	];

	// Initialize bookmark state
	function updateBookmarkState(user: User | null) {
		if (user && Array.isArray(user.bookmarks) && message) {
			isBookmarkedState = user.bookmarks.includes(message.id);
		} else {
			isBookmarkedState = false;
		}
	}

	// Initialize on component mount
	$: updateBookmarkState($currentUser);

	async function handleReaction(action: string) {
		try {
			// Only process reactions for assistant messages
			if (message.role !== 'assistant') {
				console.log('Reactions only available for assistant messages');
				return;
			}

			switch (action) {
				case 'bookmark':
					const user = $currentUser;
					if (!user) return;

					// Determine if we're adding or removing
					const bookmarkAction = isBookmarkedState ? 'remove' : 'add';

					// Use API route with POST method
					const response = await fetch('/api/bookmarks', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							messageId: message.id,
							action: bookmarkAction
						})
					});

					if (!response.ok) {
						throw new Error('Failed to update bookmark');
					}

					const result = await response.json();

					if (result.success) {
						// Update local state
						isBookmarkedState = !isBookmarkedState;
						bookmarkTooltipText = isBookmarkedState
							? 'Added to bookmarks'
							: 'Removed from bookmarks';

						// Update the current user store with new bookmarks
						currentUser.update((currentUser) => {
							if (!currentUser) return currentUser;
							return {
								...currentUser,
								bookmarks: result.bookmarks
							};
						});

						// Notify parent component
						dispatch('update', {
							messageId: message.id,
							action: 'bookmark',
							success: true
						});
					} else {
						throw new Error(result.message || 'Bookmark operation failed');
					}

					showBookmarkTooltip = true;
					setTimeout(() => {
						showBookmarkTooltip = false;
					}, 1000);
					break;

				case 'copy':
					await MarkupFormatter.copyAsPlainText(message.text || message.content);

					showCopiedTooltip = true;
					setTimeout(() => {
						showCopiedTooltip = false;
					}, 1000);
					break;

				case 'reply':
					dispatch('reply', {
						messageId: message.id
					});
					break;

				case 'task':
					dispatch('createTask', {
						messageId: message.id,
						content: message.content,
						threadId: message.thread,
						model: message.model
					});

					taskTooltipText = 'Creating task...';
					showTaskTooltip = true;
					setTimeout(() => {
						showTaskTooltip = false;
					}, 1000);
					break;
				case 'selectResponse':
					dispatch('selectResponse', {
						messageId: message.id,
						content: message.content,
						systemPrompt: message.system_prompt || '',
						model: message.model
					});

					selectionTooltipText = 'Selected!';
					showSelectionTooltip = true;
					setTimeout(() => {
						showSelectionTooltip = false;
					}, 1000);
					break;
			}
		} catch (error) {
			console.error('Error handling reaction:', error);
			dispatch('notification', {
				message: error.message || 'Failed to process request',
				type: 'error'
			});

			if (action === 'bookmark') {
				bookmarkTooltipText = 'Failed to update bookmark';
				showBookmarkTooltip = true;
				setTimeout(() => {
					showBookmarkTooltip = false;
				}, 1000);
			} else if (action === 'task') {
				taskTooltipText = 'Failed to create task';
				showTaskTooltip = true;
				setTimeout(() => {
					showTaskTooltip = false;
				}, 1000);
			} else if (action === 'selectResponse') {
				selectionTooltipText = 'Failed to select';
				showSelectionTooltip = true;
				setTimeout(() => {
					showSelectionTooltip = false;
				}, 1000);
			}
		}
	}
</script>

<div class="message-reactions">
	{#if message.role === 'assistant'}
		<div class="reaction-buttons">
			{#each reactions as reaction}
				<button
					class="reaction-btn"
					class:bookmarked={reaction.action === 'bookmark' && isBookmarkedState}
					class:dual-response={isDualResponse && reaction.action === 'selectResponse'}
					on:click={() => handleReaction(reaction.action)}
					title={reaction.label}
				>
					<div class="reaction-content">
						<svelte:component this={reaction.symbol} size={20} />
					</div>
				</button>
			{/each}
		</div>
	{/if}

	{#if isDualResponse}
		<div class="dual-response-badge">
			{isPrimaryDualResponse ? 'Option A' : 'Option B'}
		</div>
	{/if}

	{#if showBookmarkTooltip}
		<div class="bookmark-tooltip">{bookmarkTooltipText}</div>
	{/if}

	{#if showCopiedTooltip}
		<div class="copied-tooltip">Copied!</div>
	{/if}
	{#if showTaskTooltip}
		<div class="task-tooltip">{taskTooltipText}</div>
	{/if}
	{#if showSelectionTooltip}
		<div class="selection-tooltip">{selectionTooltipText}</div>
	{/if}
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	.message-reactions {
		position: relative; // Keep this
		display: flex; // Changed from inline-block
		overflow: visible; // Changed from hidden to show tooltips
		justify-content: flex-start;
		height: auto;
		width: 100%;
		transition: width 0.3s ease-in-out;
	}

	.reaction-buttons {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		align-items: center;
		padding: {
			left: 0;
			right: 0;
		}
		gap: 2rem;
		height: auto;
		width: 100%;
		white-space: nowrap;
		transition: all 0.3s ease;
		position: relative;
	}

	.copied-tooltip,
	.bookmark-tooltip {
		position: absolute;
		top: -20px;
		padding: 0.5rem 1rem;
		left: 20%;
		transform: translateX(-50%);
		background-color: var(--secondary-color);
		color: var(--text-color);
		border-radius: var(--radius-s);
		font-size: 12px;
		pointer-events: none;
		white-space: nowrap;
		z-index: 1000; // Added z-index
	}
	.task-tooltip {
		position: absolute;
		top: -30px;
		right: 0;
		background-color: var(--success-color, #4caf50);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		z-index: 10;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
		to {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
	}

	.copied-tooltip {
		animation:
			fadeIn 0.2s ease-in,
			fadeOut 0.2s ease-out 0.8s forwards;
	}

	.bookmark-tooltip {
		animation:
			fadeIn 0.2s ease-in,
			fadeOut 0.2s ease-out 0.8s forwards;
	}
	.reaction-content {
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;

		margin: 0;
		padding: 0;
		width: 2rem;
		height: 2rem;
	}
	.reaction-btn {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 2rem !important;
		height: 2rem !important;
		margin: 0 !important;
		padding: 0 !important;
		font-size: auto;
		font-weight: bold;
		color: var(--placeholder-color);
		background-color: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		opacity: 0.5;
		transition: all 0.1s ease-in-out;

		&.bookmarked {
			color: var(--tertiary-color);
			// background-color: var(--secondary-color);
			border-radius: var(--radius-m);
			opacity: 1;

			:global(svg) {
				fill: var(--tertiary-color) !important;
				stroke: var(--tertiary-color) !important;
			}
		}

		&:hover {
			color: var(--tertiary-color);

			:global(svg) {
				stroke: var(--tertiary-color);
			}
		}
	}
	/* Hover effect */
	.message-reactions:hover {
		background: transparent !important;
		.reaction-btn {
			opacity: 1;
		}
	}

	:global(.bookmarked-icon) {
		fill: var(--tertiary-color) !important;
		stroke: var(--tertiary-color) !important;
	}

	@media (max-width: 450px) {
		.message-reactions {
			button.reaction-btn {
				padding: 0;
			}
		}
	}
</style>
