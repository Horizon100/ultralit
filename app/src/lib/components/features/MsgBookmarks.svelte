<script lang="ts">
    import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import { Loader2 } from 'lucide-svelte';
    import type { Messages, User } from '$lib/types/types';
    import { pb, currentUser, ensureAuthenticated } from '$lib/pocketbase';
  
    let bookmarkedMessages: Messages[] = [];
    let isLoading = true;
  
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
        console.log('Filter conditions:', filterConditions);
  
        const records = await pb.collection('messages').getList<Messages>(1, 50, {
          filter: filterConditions,
          sort: '-created',
          expand: 'user'
        });
  
        bookmarkedMessages = records.items;
      } catch (error) {
        console.error('Error fetching bookmarked messages:', error);
        // Try to fetch messages one by one if bulk fetch fails
        try {
          const messages = await Promise.all(
            $currentUser?.bookmarks.map(async (id) => {
              try {
                return await pb.collection('messages').getOne<Messages>(id);
              } catch (e) {
                console.log(`Failed to fetch message ${id}:`, e);
                return null;
              }
            }) ?? []
          );
          bookmarkedMessages = messages.filter((msg): msg is Messages => msg !== null);
        } catch (fallbackError) {
          console.error('Fallback fetch failed:', fallbackError);
        }
      } finally {
        isLoading = false;
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
    <div class="flex items-center justify-center p-4">
      <Loader2 class="h-6 w-6 animate-spin text-gray-500" />
    </div>
  {:else if !bookmarkedMessages.length}
    <div class="p-4 text-center text-gray-500">
      <p>No bookmarked messages yet</p>
      <p class="text-xs mt-2 text-gray-400">
        Bookmarks in user data: {$currentUser?.bookmarks?.join(', ')}
      </p>
    </div>
  {:else}
    <div class="section-content-bookmark space-y-4 p-4" transition:slide={{ duration: 200 }}>
      {#each bookmarkedMessages as message (message.id)}
        <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <p class="text-sm font-medium text-gray-900">
                {message.type === 'human' ? 'You' : 'Assistant'}
              </p>
              <p class="text-sm text-gray-500">
                {new Date(message.created).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div class="mt-2">
            <p class="text-sm text-gray-700">{message.text}</p>
          </div>
          {#if message.attachments}
            <div class="mt-2">
              <p class="text-xs text-gray-500">Has attachments</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}