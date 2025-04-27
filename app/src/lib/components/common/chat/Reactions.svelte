<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import {  currentUser } from '$lib/pocketbase';
    import type { InternalChatMessage, Messages, User } from '$lib/types/types';
    import { Bookmark, Copy } from 'lucide-svelte';
    import type { SvelteComponentTyped } from 'svelte';
    import { MarkupFormatter } from '$lib/utils/markupFormatter';

    export let message: InternalChatMessage;
    export let userId: string;

    const dispatch = createEventDispatcher();
    let showCopiedTooltip = false;
    let showBookmarkTooltip = false;
    let bookmarkTooltipText = '';
    let isBookmarkedState = false;

    // Define type for Lucide icons
    type IconComponent = SvelteComponentTyped<{
        size?: number | string;
        color?: string;
        strokeWidth?: number | string;
        class?: string;
    }>;

    type Reaction = {
        symbol: typeof Bookmark | typeof Copy ;
        action: string;
        label: string;
        isIcon: boolean;
    };

    const reactions: Reaction[] = [
        {
            symbol: Bookmark,
            action: 'bookmark',
            label: 'Bookmark',
            isIcon: true
        },
        {
            symbol: Copy,
            action: 'copy',
            label: 'Copy to Clipboard',
            isIcon: true
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
            switch (action) {
                case 'bookmark':
                    const user = $currentUser;
                    if (!user) return;

                    const currentBookmarks = user.bookmarks || [];
                    let updatedBookmarks: string[];

                    if (currentBookmarks.includes(message.id)) {
                        updatedBookmarks = currentBookmarks.filter((id) => id !== message.id);
                        bookmarkTooltipText = 'Removed from bookmarks';
                    } else {
                        updatedBookmarks = [...currentBookmarks, message.id];
                        bookmarkTooltipText = 'Added to bookmarks';
                    }

                    // Update PocketBase
                    await pb.collection('users').update(user.id, {
                        bookmarks: updatedBookmarks
                    });

                    // Update store
                    currentUser.update((currentUser) => {
                        if (!currentUser) return currentUser;
                        return {
                            ...currentUser,
                            bookmarks: updatedBookmarks
                        };
                    });

                    showBookmarkTooltip = true;
                    setTimeout(() => {
                        showBookmarkTooltip = false;
                    }, 1000);
                    break;

                case 'copy':
                    // Use the new utility to copy as plain text instead
                    await MarkupFormatter.copyAsPlainText(message.text);
                    showCopiedTooltip = true;
                    setTimeout(() => {
                        showCopiedTooltip = false;
                    }, 1000);
                    break;
            }
        } catch (error) {
            console.error('Error handling reaction:', error);
            bookmarkTooltipText = 'Failed to update bookmark';
            showBookmarkTooltip = true;
            setTimeout(() => {
                showBookmarkTooltip = false;
            }, 1000);
        }
    }
</script>

<div class="message-reactions">
    <div class="reaction-buttons">
        {#each reactions as reaction}
            <button
                class="reaction-btn"
                class:bookmarked={reaction.action === 'bookmark' && isBookmarkedState}
                on:click={() => handleReaction(reaction.action)}
                title={reaction.label}
            >
                <div class="reaction-content">
                    <svelte:component
                        this={reaction.symbol}
                        size={20}
                        class={reaction.action === 'bookmark' && isBookmarkedState ? 'bookmarked-icon' : ''}
                    />
                </div>
            </button>
        {/each}
    </div>

    {#if showBookmarkTooltip}
        <div class="bookmark-tooltip">{bookmarkTooltipText}</div>
    {/if}

    {#if showCopiedTooltip}
        <div class="copied-tooltip">Copied!</div>
    {/if}
</div>
<style lang="scss">
	@use "src/styles/themes.scss" as *;
	.message-reactions {
		position: relative; // Keep this
		display: flex; // Changed from inline-block
		overflow: visible; // Changed from hidden to show tooltips
		justify-content: flex-end;
		height: auto;
		width: 100%;
		transition: width 0.3s ease-in-out;
	}

	.reaction-buttons {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: {
			left: 0;
			right: 2rem;
		}
		gap: 1rem !important;
		height: 100%;
		width: auto; // Changed from 100%
		white-space: nowrap;
		transition: all 0.3s ease;
		position: relative; // Added for tooltip positioning
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
