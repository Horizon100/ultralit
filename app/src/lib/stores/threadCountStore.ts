// messageCountsStore.ts
import { writable, derived } from 'svelte/store';
import { pb } from '$lib/pocketbase';
import type { Threads } from '$lib/types/types';

interface ThreadCounts {
  [threadId: string]: number;
}

interface BatchResult {
  counts: ThreadCounts;
  totalThreads: number;
}

function createThreadCountsStore() {
  const { subscribe, set, update } = writable<ThreadCounts>({});
  
  let batchSize = 50; // Default batch size for pagination
  let isFetching = false;

  return {
    subscribe,
    
    // Fetch message counts for visible threads with pagination
    async fetchBatch(threads: Threads[], page: number = 1): Promise<BatchResult> {
      if (isFetching) return { counts: {}, totalThreads: 0 };
      
      isFetching = true;
      const counts: ThreadCounts = {};
      
      try {
        const start = (page - 1) * batchSize;
        const batchThreads = threads.slice(start, start + batchSize);
        
        const results = await Promise.all(
          batchThreads.map(async (thread) => {
            try {
              const result = await pb.collection('project_id').getList(1, 1, {
                filter: `thread = "${thread.id}"`,
                $autoCancel: false
              });
              return { threadId: thread.id, count: result.totalItems };
            } catch (error) {
              console.error(`Error fetching count for thread ${thread.id}:`, error);
              return { threadId: thread.id, count: 0 };
            }
          })
        );
        
        results.forEach(({ threadId, count }) => {
          counts[threadId] = count;
        });

        update(current => ({ ...current, ...counts }));
        
        return {
          counts,
          totalThreads: threads.length
        };
      } finally {
        isFetching = false;
      }
    },

    // Update count for a single thread
    async updateCount(threadId: string): Promise<number> {
      try {
        const result = await pb.collection('project_id').getList(1, 1, {
          filter: `thread = "${threadId}"`,
          $autoCancel: false
        });
        
        const count = result.totalItems;
        
        update(counts => ({
          ...counts,
          [threadId]: count
        }));
        
        return count;
      } catch (error) {
        console.error(`Error updating count for thread ${threadId}:`, error);
        return 0;
      }
    },

    // Optimistic updates
    increment(threadId: string) {
      update(counts => ({
        ...counts,
        [threadId]: (counts[threadId] || 0) + 1
      }));
    },

    decrement(threadId: string) {
      update(counts => ({
        ...counts,
        [threadId]: Math.max(0, (counts[threadId] || 1) - 1)
      }));
    },

    // Set batch size
    setBatchSize(size: number) {
      batchSize = size;
    },

    // Reset store
    reset() {
      set({});
    }
  };
}

export const threadCountsStore = createThreadCountsStore();
export const threadCounts = derived(
  threadCountsStore,
  $counts => {
    const maxCount = Math.max(...Object.values($counts), 50); // Default to 50 if no counts
    return {
      getCount: (threadId: string) => $counts[threadId] ?? 0,
      hasCount: (threadId: string) => threadId in $counts,
      maxCount: maxCount
    };
  }
);