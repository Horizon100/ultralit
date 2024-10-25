// messageCountsStore.ts
import { writable, derived } from 'svelte/store';
import { pb } from '$lib/pocketbase';

function createMessageCountsStore() {
  const { subscribe, set, update } = writable<{ [threadId: string]: number }>({});

  return {
    subscribe,
    
    // Fetch message counts for multiple threads
    async fetchCounts(threadIds: string[]) {
      const counts: { [threadId: string]: number } = {};
      
      await Promise.all(
        threadIds.map(async (threadId) => {
          try {
            const result = await pb.collection('messages').getList(1, 1, {
              filter: `thread = "${threadId}"`,
            });
            counts[threadId] = result.totalItems;
          } catch (error) {
            console.error(`Error fetching message count for thread ${threadId}:`, error);
            counts[threadId] = 0;
          }
        })
      );

      update(current => ({ ...current, ...counts }));
    },

    // Update count for a single thread
    async updateCount(threadId: string) {
      try {
        const result = await pb.collection('messages').getList(1, 1, {
          filter: `thread = "${threadId}"`,
        });
        update(counts => ({
          ...counts,
          [threadId]: result.totalItems
        }));
      } catch (error) {
        console.error(`Error updating message count for thread ${threadId}:`, error);
      }
    },

    // Increment count for a thread (for optimistic updates)
    increment(threadId: string) {
      update(counts => ({
        ...counts,
        [threadId]: (counts[threadId] || 0) + 1
      }));
    },

    // Reset the store
    reset() {
      set({});
    }
  };
}

export const messageCountsStore = createMessageCountsStore();