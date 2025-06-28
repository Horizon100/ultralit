import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) =>
	apiTryCatch(
		async () => {
			const user = locals.user;
			if (!user?.id) {
				throw new Error('Authentication required');
			}

			const userData = await pb.collection('users').getOne(user.id);

			let favoriteThreads: string[] = [];
			if (userData.favoriteThreads) {
				if (Array.isArray(userData.favoriteThreads)) {
					favoriteThreads = userData.favoriteThreads;
				} else if (typeof userData.favoriteThreads === 'string') {
					try {
						favoriteThreads = JSON.parse(userData.favoriteThreads);
					} catch {
						favoriteThreads = [userData.favoriteThreads];
					}
				}
			}

			if (!favoriteThreads.length) {
				return { threads: [], favoriteThreads: [] };
			}

			const filter = favoriteThreads.map((id) => `id = '${id}'`).join(' || ');

			const records = await pb.collection('threads').getList(1, 50, {
				filter,
				sort: '-created',
				expand: 'user,op'
			});

			const threads = records.items.map((thread) => ({
				id: thread.id,
				name: thread.name,
				created: thread.created,
				updated: thread.updated,
				user: thread.user,
				op: thread.op
			}));

			return { threads, favoriteThreads };
		},
		'Failed to fetch favorites',
		500
	);

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(
		async () => {
			const user = locals.user;

			if (!user?.id) {
				throw new Error('Authentication required');
			}

			const { threadId, action } = await request.json();

			if (!threadId || !['add', 'remove'].includes(action)) {
				throw new Error(
					'Invalid request parameters. threadId and action (add/remove) are required.'
				);
			}

			const userData = await pb.collection('users').getOne(user.id);

			let currentFavoriteThreads: string[] = [];
			if (userData.favoriteThreads) {
				if (Array.isArray(userData.favoriteThreads)) {
					currentFavoriteThreads = userData.favoriteThreads;
				} else if (typeof userData.favoriteThreads === 'string') {
					try {
						currentFavoriteThreads = JSON.parse(userData.favoriteThreads);
					} catch {
						currentFavoriteThreads = [userData.favoriteThreads];
					}
				}
			}

			let updatedFavoriteThreads: string[];

			if (action === 'add') {
				if (!currentFavoriteThreads.includes(threadId)) {
					updatedFavoriteThreads = [...currentFavoriteThreads, threadId];
					console.log(
						`Adding thread ${threadId} to favorites. New count: ${updatedFavoriteThreads.length}`
					);
				} else {
					updatedFavoriteThreads = currentFavoriteThreads;
					console.log(`Thread ${threadId} already in favorites`);
				}
			} else {
				updatedFavoriteThreads = currentFavoriteThreads.filter((id) => id !== threadId);
				console.log(
					`Removing thread ${threadId} from favorites. New count: ${updatedFavoriteThreads.length}`
				);
			}

			await pb.collection('users').update(user.id, {
				favoriteThreads: updatedFavoriteThreads
			});

			const verifyUser = await pb.collection('users').getOne(user.id);
			console.log('Updated favoriteThreads in database:', verifyUser.favoriteThreads);

			return {
				favoriteThreads: updatedFavoriteThreads,
				message: action === 'add' ? 'Added to favorites' : 'Removed from favorites',
				count: updatedFavoriteThreads.length
			};
		},
		'Failed to update favorites',
		500
	);
