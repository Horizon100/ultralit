import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = params.id;

	async function checkEligiblePerks(stats: { threadCount: number; messageCount: number; taskCount: number; tagCount: number }) {
		console.log('Checking perks for stats:', stats);
		return [];
	}

	async function updateUserPerks(userId: string, perks: unknown[]) {
		console.log('Updating perks for user:', userId, 'perks:', perks);
	}

	try {
		const pocketBase = locals?.pb || pb;

		console.log('=== STATS DEBUG ===');
		console.log('PocketBase URL:', pb.baseUrl);
		console.log('User ID:', userId);

		const user = await pocketBase.collection('users').getOne(userId);

		if (!user) {
			throw error(404, 'User not found');
		}

		let threadCount = 0;
		let messageCount = 0;
		let taskCount = 0;
		let tagCount = 0;
		const timerCount = 0; // Changed to const since never reassigned
		let lastActive: Date | null = null;

		console.log('Fetching stats for user:', userId);

		// Thread count
		try {
			const threadFilter = `op="${userId}"`;
			const threadsResult = await pocketBase.collection('threads').getList(1, 1, {
				filter: threadFilter
			});
			threadCount = threadsResult.totalItems;
			console.log('Thread count:', threadCount);
		} catch (e) {
			console.error('Error counting threads:', e);
		}

		// Task count
		try {
			const taskFilter = `createdBy="${userId}"`;
			const taskResults = await pocketBase.collection('tasks').getList(1, 1, {
				filter: taskFilter
			});
			taskCount = taskResults.totalItems;
			console.log('Task count:', taskCount);
		} catch (e) {
			console.error('Error counting tasks:', e);
		}

		// Message count
		try {
			const messageFilter = `user="${userId}"`;
			const messagesResult = await pocketBase.collection('messages').getList(1, 1, {
				filter: messageFilter
			});
			messageCount = messagesResult.totalItems;
			console.log('Message count:', messageCount);

			if (messageCount > 0) {
				const latestMessage = await pocketBase.collection('messages').getList(1, 1, {
					filter: messageFilter,
					sort: '-created'
				});
				if (latestMessage.items.length > 0 && latestMessage.items[0].created) {
					const messageDate = new Date(latestMessage.items[0].created);
					if (!lastActive || messageDate > (lastActive as Date)) {
						lastActive = messageDate;
					}
}
			}
		} catch (e) {
			console.error('Error counting messages:', e);
		}

		// Tag count
		try {
			const tagFilter = `createdBy="${userId}"`;
			const tagsResult = await pocketBase.collection('tags').getList(1, 1, {
				filter: tagFilter
			});
			tagCount = tagsResult.totalItems;
			console.log('Tag count:', tagCount);
		} catch (e) {
			console.error('Error counting tags:', e);
		}

		// Set lastActive if not found
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
		try {
			if (user.perks && user.perks.length > 0) {
				const filter = user.perks.map((id: string) => `id="${id}"`).join(' || ');
				const perksResult = await pocketBase.collection('perks').getList(1, 100, {
					filter: filter
				});
				perks = perksResult.items;
			}
		} catch (e) {
			console.error('Error fetching perks:', e);
		}

		return json({
			success: true,
			threadCount,
			messageCount,
			taskCount,
			tagCount,
			timerCount,
			lastActive: lastActive ? lastActive.toISOString() : null,
			perks: perks
		});
	} catch (err) {
		console.error('=== STATS ERROR ===');
		console.error('Error fetching user stats:', err);
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Failed to fetch user stats'
			},
			{ status: 400 }
		);
	}
};