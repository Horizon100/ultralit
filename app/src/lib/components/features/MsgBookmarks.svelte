<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import { Loader2, MessageSquare, Copy } from 'lucide-svelte';
  import type { Messages, User, Threads } from '$lib/types/types';
  import { pb, currentUser, ensureAuthenticated } from '$lib/pocketbase';
  import { MarkupFormatter } from '$lib/utils/markupFormatter';

  let bookmarkedMessages: (Messages & { threadName?: string })[] = [];
  let isLoading = true;
  let threadLoading: Record<string, boolean> = {};
  let copyTooltips: Record<string, boolean> = {};

  const dispatch = createEventDispatcher();

  async function fetchBookmarkedMessages() {
    try {
      const isAuthed = await ensureAuthenticated();
      if (!isAuthed) {
        console.error('Not authenticated');
        return;
      }

      const user = $currentUser;
      if (!user?.bookmarks?.length) {
        bookmarkedMessages = [];
        isLoading = false;
        return;
      }

      // Using individual OR conditions for each ID
      const filterConditions = user.bookmarks.map(id => `id = '${id}'`).join(' || ');

      const records = await pb.collection('messages').getList<Messages>(1, 50, {
        filter: filterConditions,
        sort: '-created',
        expand: 'user'
      });

      const messagesWithThreadNames = await Promise.all(
        records.items.map(async (message) => {
          if (message.thread) {
            try {
              const thread = await pb.collection('threads').getOne<Threads>(message.thread);
              return { ...message, threadName: thread.name };
            } catch (e) {
              console.log(`Failed to fetch thread for message ${message.id}:`, e);
              return { ...message, threadName: 'Unknown Thread' };
            }
          }
          return { ...message, threadName: 'No Thread' };
        })
      );

      bookmarkedMessages = messagesWithThreadNames;
    } catch (error) {
      console.error('Error fetching bookmarked messages:', error);
      // Fallback
      try {
        const messages = await Promise.all(
          $currentUser?.bookmarks.map(async (id) => {
            try {
              const message = await pb.collection('messages').getOne<Messages>(id);
              if (message.thread) {
                try {
                  const thread = await pb.collection('threads').getOne<Threads>(message.thread);
                  return { ...message, threadName: thread.name };
                } catch (e) {
                  return { ...message, threadName: 'Unknown Thread' };
                }
              }
              return { ...message, threadName: 'No Thread' };
            } catch (e) {
              console.log(`Failed to fetch message ${id}:`, e);
              return null;
            }
          }) ?? []
        );
        bookmarkedMessages = messages.filter((msg): msg is Messages & { threadName?: string } => msg !== null);
      } catch (fallbackError) {
        console.error('Fallback fetch failed:', fallbackError);
      }
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
<div class="loading-container">
  <Loader2 class="loading-spinner" />
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
            <Copy size={16} />
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
                <Loader2 class="loading-spinner-small" />
              {:else}
                <MessageSquare size={16} />
                <span>Open Thread</span>
              {/if}
            </button>
          {/if}
        </div>
      </div>
      <div class="message-content">
        <p>{@html message.text}</p>
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

<style>
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
  flex-direction: column;
  position: absolute;
  bottom: 4rem;
  gap: 1rem;
  width: calc(100% - 4rem);
  padding: 1rem;
  max-height: 50vh;
  backdrop-filter: blur(50px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--secondary-color) var(--primary-color);
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
</style>