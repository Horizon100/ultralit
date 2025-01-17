<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { pb, currentUser } from '$lib/pocketbase';
  import type { Messages } from '$lib/types/types';
  import { Bookmark, Copy } from 'lucide-svelte';
  import type { SvelteComponent } from 'svelte';

  export let message: Messages;
  export let userId: string;

  const dispatch = createEventDispatcher();
  let showCopiedTooltip = false;
  let showBookmarkTooltip = false;
  let bookmarkTooltipText = '';
  let isBookmarkedState = $currentUser?.bookmarks?.includes(message.id) || false;  // Track state locally

  type Reaction = {
    symbol: typeof SvelteComponent;
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

  async function handleReaction(action: string) {
    try {
      switch (action) {
        case 'bookmark':
          const user = $currentUser;
          if (!user) return;

          let updatedBookmarks: string[];
          
          if (isBookmarkedState) {
            updatedBookmarks = user.bookmarks.filter(id => id !== message.id);
            bookmarkTooltipText = 'Removed from bookmarks';
          } else {
            updatedBookmarks = [...(user.bookmarks || []), message.id];
            bookmarkTooltipText = 'Added to bookmarks';
          }

          // Update PocketBase
          await pb.collection('users').update(user.id, {
            bookmarks: updatedBookmarks
          });

          // Update local state first
          isBookmarkedState = !isBookmarkedState;

          // Update store
          currentUser.update(u => ({
            ...u,
            bookmarks: updatedBookmarks
          }));

          // Show tooltip
          showBookmarkTooltip = true;
          setTimeout(() => {
            showBookmarkTooltip = false;
          }, 1000);
          break;

        case 'copy':
          await navigator.clipboard.writeText(message.text);
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

  // Update local state when store changes
  $: {
    if ($currentUser) {
      isBookmarkedState = $currentUser.bookmarks?.includes(message.id) || false;
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
            size={16} 
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
  .message-reactions {
  position: relative;  // Keep this
  display: flex;       // Changed from inline-block
  overflow: visible;   // Changed from hidden to show tooltips
  justify-content: flex-start;
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
  width: auto;        // Changed from 100%
  white-space: nowrap;
  transition: all 0.3s ease;
  position: relative;  // Added for tooltip positioning
}

.reaction-btn {
  position: relative;  // Added for tooltip positioning
  font-family: var(--font-family);
  font-size: 1rem;
  font-weight: bold;
  color: var(--placeholder-color);
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 1rem;
  margin: 0 2px;
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
    transform: scale(1.2);
    
    :global(svg) {
      stroke: var(--tertiary-color);
    }
  }
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
  z-index: 1000;        // Added z-index
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }

.copied-tooltip {
  animation: fadeIn 0.2s ease-in, fadeOut 0.2s ease-out 0.8s forwards;
}

.bookmark-tooltip {
  animation: fadeIn 0.2s ease-in, fadeOut 0.2s ease-out 0.8s forwards;
}

/* Hover effect */
.message-reactions:hover {
  .reaction-btn {
    opacity: 1;
  }
}

:global(.bookmarked-icon) {
  fill: var(--tertiary-color) !important;
  stroke: var(--tertiary-color) !important;
}
</style>