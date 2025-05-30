// src/routes/api/users/public/batch/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userIds } = await request.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'Invalid request format' }, { status: 400 });
		}

		// Limit batch size to prevent abuse
		const batchSize = Math.min(userIds.length, 50);
		const limitedUserIds = userIds.slice(0, batchSize);

		// Construct filter to fetch these users
		const filter = limitedUserIds.map((id) => `id = "${id}"`).join(' || ');

		// Only fetch public fields that unauthenticated users can see
		const users = await pb.collection('users').getList(1, batchSize, {
			filter: filter,
			fields: 'id,username,name,avatar,verified,description,role,created' // Only basic public fields
		});

		// Map to public profiles with only allowed fields
		const publicProfiles = users.items.map((user) => ({
			id: user.id,
			username: user.username || '',
			name: user.name || '',
			avatar: user.avatar || '',
			verified: user.verified || false,
			description: user.description || '',
			role: user.role || 'user',
			created: user.created
		}));

		return json(publicProfiles);
	} catch (error) {
		console.error('Error fetching batch public profiles:', error);
		return json({ error: 'Failed to fetch user profiles' }, { status: 500 });
	}
};