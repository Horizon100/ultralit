// src/routes/game/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw redirect(303, '/api/verify/signin');
	}

	const user = locals.pb.authStore.model;

	if (!user) {
		throw redirect(303, '/api/verify/signin');
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
};
