import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		// Clear PocketBase auth
		pbServer.signOut();

		// Remove auth cookie
		cookies.delete('pb_auth', { path: '/' });

		return json({ success: true });
	} catch (error) {
		console.error('Sign-out error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Sign-out failed'
			},
			{ status: 500 }
		);
	}
};
