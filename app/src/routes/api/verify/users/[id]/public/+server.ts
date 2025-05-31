// src/routes/api/verify/users/[id]/public/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;

		// Get user record from PocketBase
		const record = await pb.collection('users').getOne(id);

		// Return only public fields
		const publicUser = {
			id: record.id,
			name: record.name || record.username || 'User',
			avatar: record.avatar,
			username: record.username,
			wallpaper_preference: record.wallpaper_preference,
			created: record.created,
			updated: record.updated
		};

		return json({
			success: true,
			user: publicUser
		});
	} catch (error) {
		console.error('Error fetching public user data:', error);
		return json(
			{
				success: false,
				error: 'User not found'
			},
			{ status: 404 }
		);
	}
};
