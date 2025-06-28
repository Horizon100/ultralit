import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		const userId = params.id;
		if (!userId) {
			throw new Error('User ID is required');
		}
		const pocketBase = locals?.pb || pb;

		const userResult = await pbTryCatch(
			pocketBase.collection('users').getOne(userId),
			'fetch user'
		);
		const user = unwrap(userResult);
		if (!user) throw new Error('User not found');

		async function checkEligiblePerks(stats: {
			threadCount: number;
			messageCount: number;
			taskCount: number;
			tagCount: number;
		}) {
			console.log('Checking perks for stats:', stats);
			return [];
		}

		async function updateUserPerks(userId: string, perks: unknown[]) {
			console.log('Updating perks for user:', userId, 'perks:', perks);
		}

		// Helper to safely count items in a collection
		async function safeCount(collectionName: string, filter: string): Promise<number> {
			try {
				const result = await pocketBase.collection(collectionName).getList(1, 1, { filter });
				return result.totalItems;
			} catch (e) {
				console.error(`Error counting ${collectionName}:`, e);
				return 0;
			}
		}

		const threadCount = await safeCount('threads', `op="${userId}"`);
		const taskCount = await safeCount('tasks', `createdBy="${userId}"`);
		const messageCount = await safeCount('messages', `user="${userId}"`);
		const tagCount = await safeCount('tags', `createdBy="${userId}"`);

		let lastActive: Date | null = null;

		if (messageCount > 0) {
			try {
				const messagesResult = await pocketBase.collection('messages').getList(1, 1, {
					filter: `user="${userId}"`,
					sort: '-created'
				});
				if (messagesResult.items.length > 0 && messagesResult.items[0].created) {
					lastActive = new Date(messagesResult.items[0].created);
				}
			} catch (e) {
				console.error('Error fetching latest message:', e);
			}
		}

		if (!lastActive) {
			if (user.updated) {
				lastActive = new Date(user.updated);
			} else if (user.created) {
				lastActive = new Date(user.created);
			}
		}

		const stats = { threadCount, messageCount, taskCount, tagCount };
		const eligiblePerks = await checkEligiblePerks(stats);
		await updateUserPerks(userId, eligiblePerks);

		let perks: unknown[] = [];
		if (user.perks && user.perks.length > 0) {
			try {
				const filter = user.perks.map((id: string) => `id="${id}"`).join(' || ');
				const perksResult = await pocketBase.collection('perks').getList(1, 100, {
					filter
				});
				perks = perksResult.items;
			} catch (e) {
				console.error('Error fetching perks:', e);
			}
		}

		return {
			success: true,
			threadCount,
			messageCount,
			taskCount,
			tagCount,
			timerCount: 0,
			lastActive: lastActive ? lastActive.toISOString() : null,
			perks
		};
	}, 'Failed to fetch user stats');
