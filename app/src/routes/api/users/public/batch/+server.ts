// src/routes/api/users/public/batch/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Ensure the requester is authenticated
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

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

		const users = await pb.collection('users').getList(1, batchSize, {
			filter: filter
		});

		// Map to public profiles with only allowed fields
		const publicProfiles = users.items.map((user) => ({
			id: user.id,
			username: user.username,
			name: user.name || '',
			avatar: user.avatar,
			verified: user.verified,
			description: user.description || '',
			role: user.role,
			last_login: user.last_login,
			perks: user.activated_features || [],
			taskAssignments: user.taskAssignments || [],
			userTaskStatus: user.userTaskStatus || {
				backlog: 0,
				todo: 0,
				focus: 0,
				done: 0,
				hold: 0,
				postpone: 0,
				cancel: 0,
				review: 0,
				delegate: 0,
				archive: 0
			},
			userProjects: user.projects || [],
			hero: user.hero || '',
			created: user.created
		}));

		return json(publicProfiles);
	} catch (error) {
		console.error('Error fetching batch public profiles:', error);
		return json({ error: 'Failed to fetch user profiles' }, { status: 500 });
	}
};
