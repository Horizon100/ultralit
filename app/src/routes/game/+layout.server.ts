// src/routes/game/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import { userApiTryCatch } from '$lib/utils/errorUtils';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return await userApiTryCatch(async () => {
		// Check authentication
		if (!locals.pb.authStore.isValid) {
			// Redirect to signin instead of returning error for auth failures
			throw redirect(303, '/api/verify/signin');
		}

		const user = locals.pb.authStore.model;

		if (!user) {
			throw redirect(303, '/api/verify/signin');
		}

		// Validate user data
		if (!user.id) {
			throw new Error('Invalid user session - missing user ID');
		}

		if (!user.username) {
			throw new Error('Invalid user session - missing username');
		}

		return {
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				name: user.name || user.username,
				avatar: user.avatar
			}
		};
	}, 'game authentication');
};