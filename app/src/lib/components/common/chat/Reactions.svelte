<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { pb } from '$lib/pocketbase';
  import type { Message } from '$lib/types';
  
  export let message: Message;
  export let userId: string;

  const dispatch = createEventDispatcher();

  const reactions = [
    { symbol: '▲', action: 'upvote', label: 'Upvote' },
    { symbol: '▼', action: 'downvote', label: 'Downvote' },
    { symbol: '★', action: 'bookmark', label: 'Bookmark' },
    { symbol: '⧉', action: 'copy', label: 'Copy to Clipboard' },
    { symbol: '☆', action: 'highlight', label: 'Highlight' },
    { symbol: '?', action: 'question', label: 'Ask for Clarification' }
  ];

  async function handleReaction(action: string) {
    try {
      let updatedReactions = { ...message.reactions };

      switch (action) {
        case 'upvote':
        case 'downvote':
        case 'question':
          updatedReactions[action] = (updatedReactions[action] || 0) + 1;
          break;
        case 'bookmark':
          if (!updatedReactions.bookmark.includes(userId)) {
            updatedReactions.bookmark = [...updatedReactions.bookmark, userId];
          }
          break;
        case 'highlight':
          if (!updatedReactions.highlight.includes(userId)) {
            updatedReactions.highlight = [...updatedReactions.highlight, userId];
          }
          break;
        case 'copy':
          await navigator.clipboard.writeText(message.content);
          dispatch('notification', { 
            type: 'success', 
            message: 'Content copied to clipboard' 
          });
          break;
      }

      if (action !== 'copy') {
        dispatch('update', {
          messageId: message.id,
          reactions: updatedReactions
        });
      }

    } catch (error) {
      console.error('Error handling reaction:', error);
      dispatch('notification', {
        type: 'error',
        message: 'Failed to process reaction'
      });
    }
  }
</script>

<div class="message-reactions">
  <!-- <div class="reaction-toggle">
    ⋯
  </div> -->
  <div class="reaction-buttons">
    {#each reactions as reaction}
      <button 
        class="reaction-btn"
        on:click={() => handleReaction(reaction.action)}
        title={reaction.label}
      >
        {reaction.symbol}
        {#if message.reactions && message.reactions[reaction.action]}
          <span class="reaction-count">
            {#if Array.isArray(message.reactions[reaction.action])}
              {message.reactions[reaction.action].length}
            {:else}
              {message.reactions[reaction.action]}
            {/if}
          </span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style lang="scss">
  .message-reactions {
    position: relative;
    display: inline-block;
    overflow: hidden;
    justify-content: center;
    height: 30px;
    transition: width 0.3s ease-in-out;
    width: 100%;
    // margin-top: 1rem;
  }

  .reaction-toggle {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: transparent;
    cursor: pointer;
    background-color: transparent;
    border-radius: 15px;
  }

  .reaction-buttons {
    display: flex;
    align-items: center;
    justify-content: left;
    padding: {
      left: 0;
      right: 2rem;
    }
    gap: 1rem !important;
    height: 100%;
    width: 100%;
    white-space: nowrap;
    transition: all 0.3s ease;
    border-radius: 20px;

    &:hover {
      backdrop-filter: blur(10px);
    }


  }


  .reaction-btn {
    font-family: var(--font-family);
    font-size: 1rem;
    font-weight: bold;
    color: var(--placeholder-color);
    background-color: transparent;

    border: none;
    cursor: pointer;
    padding: 1rem;
    margin: 0 2px;
    transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 0.3s);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;

    &:hover {
      transform: scale(1.2);
      color: var(--tertiary-color);
    }

    &:active {
      transform: scale(0.9);
    }

  }

  .reaction-count {
    font-size: 12px;
    margin-left: 2px;
  }

  /* Hover effect */
  .message-reactions:hover {
    width: 100%;
    
    .reaction-btn {
      opacity: 1;
    }
  }
</style>