// threadCountsStore.ts
import { writable, derived } from 'svelte/store';
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

		// Fetch thread counts using fetch API instead of direct pocketbase access
		async fetchBatch(threads: Threads[], page: number = 1): Promise<BatchResult> {
			if (isFetching) return { counts: {}, totalThreads: 0 };

			isFetching = true;
			const counts: ThreadCounts = {};

			try {
				const start = (page - 1) * batchSize;
				const batchThreads = threads.slice(start, start + batchSize);

				// Use fetch API to call your API endpoints for thread counts
				const results = await Promise.all(
					batchThreads.map(async (thread) => {
						try {
							// Use your existing API or create a new endpoint for this
							const response = await fetch(`/api/threads/${thread.id}/count`, {
								credentials: 'include'
							});

							if (!response.ok) {
								throw new Error(`Failed to fetch count: ${response.status}`);
							}

							const data = await response.json();
							return {
								threadId: thread.id,
								count: data.count || 0
							};
						} catch (error) {
							console.error(`Error fetching count for thread ${thread.id}:`, error);
							return { threadId: thread.id, count: 0 };
						}
					})
				);

				results.forEach(({ threadId, count }) => {
					counts[threadId] = count;
				});

				update((current) => ({ ...current, ...counts }));

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
				// Use fetch API to get the count from your API
				const response = await fetch(`/api/threads/${threadId}/count`, {
					credentials: 'include'
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch count: ${response.status}`);
				}

				const data = await response.json();
				const count = data.count || 0;

				update((counts) => ({
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
			update((counts) => ({
				...counts,
				[threadId]: (counts[threadId] || 0) + 1
			}));
		},

		decrement(threadId: string) {
			update((counts) => ({
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
export const threadCounts = derived(threadCountsStore, ($counts) => {
	const maxCount = Math.max(...Object.values($counts), 50); // Default to 50 if no counts
	return {
		getCount: (threadId: string) => $counts[threadId] ?? 0,
		hasCount: (threadId: string) => threadId in $counts,
		maxCount: maxCount
	};
});
