// src/routes/api/users/[id]/avatar/+server.ts
import { pb } from '$lib/server/pocketbase';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const userId = params.id;

	// No auth check for avatars - they're public

	try {
		// Fetch the user
		const user = await pb.collection('users').getOne(userId);

		if (!user || !user.avatar) {
			// Return a default avatar
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/images/default-avatar.png'
				}
			});
		}

		// Get the avatar file URL
		const avatarUrl = pb.files.getUrl(user, user.avatar);

		return new Response(null, {
			status: 302,
			headers: {
				Location: avatarUrl
			}
		});
	} catch (err) {
		console.error('Error fetching user avatar:', err);
		throw error(404, 'User avatar not found');
	}
};
