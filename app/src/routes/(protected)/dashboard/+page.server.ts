import type { ServerLoad } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';

export const load: ServerLoad = async (event) => {
	const user = requireAuth(event);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name
		}
	};
};
