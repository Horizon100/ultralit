// threadCountsStore.ts
import { writable, derived } from 'svelte/store';
import type { Threads } from '$lib/types/types';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';

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

		async fetchBatch(threads: Threads[], page: number = 1): Promise<BatchResult> {
			if (isFetching) return { counts: {}, totalThreads: 0 };

			isFetching = true;
			const counts: ThreadCounts = {};

			const start = (page - 1) * batchSize;
			const batchThreads = threads.slice(start, start + batchSize);

			const results = await Promise.all(
				batchThreads.map(async (thread) => {
					const result = await clientTryCatch(
						fetch(`/api/threads/${thread.id}/count`, {
							credentials: 'include'
						}).then(async (res) => {
							if (!res.ok) throw new Error(`Failed to fetch count: ${res.status}`);
							return res.json();
						}),
						`Error fetching count for thread ${thread.id}`
					);

					if (isSuccess(result)) {
						return { threadId: thread.id, count: result.data.count ?? 0 };
					} else {
						console.error(result.error);
						return { threadId: thread.id, count: 0 };
					}
				})
			);

			results.forEach(({ threadId, count }) => {
				counts[threadId] = count;
			});

			update((current) => ({ ...current, ...counts }));

			isFetching = false;

			return {
				counts,
				totalThreads: threads.length
			};
		},

		async updateCount(threadId: string): Promise<number> {
			const result = await clientTryCatch(
				fetch(`/api/threads/${threadId}/count`, {
					credentials: 'include'
				}).then(async (res) => {
					if (!res.ok) throw new Error(`Failed to fetch count: ${res.status}`);
					return res.json();
				}),
				`Error updating count for thread ${threadId}`
			);

			if (isSuccess(result)) {
				const count = result.data.count ?? 0;
				update((counts) => ({ ...counts, [threadId]: count }));
				return count;
			} else {
				console.error(result.error);
				return 0;
			}
		},

		increment(threadId: string) {
			update((counts) => ({
				...counts,
				[threadId]: (counts[threadId] ?? 0) + 1
			}));
		},

		decrement(threadId: string) {
			update((counts) => ({
				...counts,
				[threadId]: Math.max(0, (counts[threadId] ?? 1) - 1)
			}));
		},

		setBatchSize(size: number) {
			batchSize = size;
		},

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
		maxCount
	};
});