// src/routes/api/verify/users/[id]/public/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { userApiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	return userApiTryCatch(async () => {
		const record = await pb.collection('users').getOne(id);

		// Return only public fields
		return {
			id: record.id,
			name: record.name || record.username || 'User',
			avatar: record.avatar,
			username: record.username,
			wallpaper_preference: record.wallpaper_preference,
			created: record.created,
			updated: record.updated
		};
	}, 'fetch public user data');
};