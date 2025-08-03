import { env } from '$env/dynamic/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		pocketbaseUrl: env.PUBLIC_POCKETBASE_URL || 'http://localhost:8090',
		user: locals.user
	};
};
