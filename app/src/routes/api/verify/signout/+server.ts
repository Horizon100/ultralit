import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ cookies }) =>
	apiTryCatch(async () => {
		// Clear PocketBase auth
		pbServer.signOut();

		// Remove auth cookie
		cookies.delete('pb_auth', { path: '/' });

		return { success: true };
	}, 'Sign-out failed');
