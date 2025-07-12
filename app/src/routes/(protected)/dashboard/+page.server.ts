import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	return {
		user: {
			id: user.id,
			email: user.email,
			name: user.name
			// Don't expose sensitive data
		}
	};
};
