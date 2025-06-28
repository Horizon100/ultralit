import { writable, derived } from 'svelte/store';
import PocketBase from 'pocketbase';
import { pocketbaseUrl } from '$lib/pocketbase';
import type { Threads } from '$lib/types/types';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';

const pb = new PocketBase(pocketbaseUrl);

interface MessageCounts {
	[threadId: string]: number;
}

interface BatchResult {
	counts: MessageCounts;
	totalThreads: number;
}

function createMessageCountsStore() {
	const { subscribe, set, update } = writable<MessageCounts>({});

	let batchSize = 50; // Default batch size for pagination
	let isFetching = false;

	return {
		subscribe,

		async fetchBatch(threads: Threads[], page: number = 1): Promise<BatchResult> {
			if (isFetching) return { counts: {}, totalThreads: 0 };
			isFetching = true;

			const counts: MessageCounts = {};

			try {
				const start = (page - 1) * batchSize;
				const batchThreads = threads.slice(start, start + batchSize);

				// Use Promise.all with clientTryCatch to catch errors per thread count fetch
				const results = await Promise.all(
					batchThreads.map(async (thread) => {
						const result = await clientTryCatch(
							pb.collection('messages').getList(1, 1, {
								filter: `thread = "${thread.id}"`,
								$autoCancel: false
							}),
							`Error fetching count for thread ${thread.id}`
						);

						if (isSuccess(result)) {
							return { threadId: thread.id, count: result.data.totalItems };
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

				return {
					counts,
					totalThreads: threads.length
				};
			} finally {
				isFetching = false;
			}
		},

		async updateCount(threadId: string): Promise<number> {
			const result = await clientTryCatch(
				pb.collection('messages').getList(1, 1, {
					filter: `thread = "${threadId}"`,
					$autoCancel: false
				}),
				`Error updating count for thread ${threadId}`
			);

			if (isSuccess(result)) {
				const count = result.data.totalItems;
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
				[threadId]: (counts[threadId] || 0) + 1
			}));
		},

		decrement(threadId: string) {
			update((counts) => ({
				...counts,
				[threadId]: Math.max(0, (counts[threadId] || 1) - 1)
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

export const messageCountsStore = createMessageCountsStore();

export function getCountColor(count: number): string {
	// Define min and max counts for scaling
	const minCount = 2;
	const maxCount = 50;
	// Normalize the count between 0 and 1
	const normalized =
		Math.min(Math.max(count - minCount, 0), maxCount - minCount) / (maxCount - minCount);

	/*
	 * Generate color using HSL
	 * Hue: 120 is green, 0 is red
	 * We reverse the normalized value since we want green for lower numbers
	 */
	const hue = 120 * (1 - normalized);

	return `hsl(${hue}, 70%, 45%)`;
}

export const messageCounts = derived(messageCountsStore, ($counts) => {
	const maxCount = Math.max(...Object.values($counts), 50); // Default to 50 if no counts
	return {
		getCount: (threadId: string) => $counts[threadId] ?? 0,
		hasCount: (threadId: string) => threadId in $counts,
		maxCount: maxCount
	};
});
