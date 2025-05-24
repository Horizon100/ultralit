// src/routes/api/verify/auth-check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// Restore auth from cookie if available
		const authCookie = cookies.get('pb_auth');
		if (authCookie) {
			try {
				const authData = JSON.parse(authCookie);
				pb.authStore.save(authData.token, authData.model);
			} catch (e) {
				console.error('Error parsing auth cookie:', e);
			}
		}

		// Refresh auth if needed
		if (pb.authStore.isValid) {
			try {
				await pb.collection('users').authRefresh();
			} catch (error) {
				console.error('Auth refresh failed:', error);
				pb.authStore.clear();
				return json({ success: false }, { status: 401 });
			}
		}

		if (!pb.authStore.isValid) {
			return json({ success: false }, { status: 401 });
		}

		// Return sanitized user data
		return json({
			success: true,
			user: {
				id: pb.authStore.model?.id,
				email: pb.authStore.model?.email,
				username: pb.authStore.model?.username,
				name: pb.authStore.model?.name,
				avatar: pb.authStore.model?.avatar
				// other safe fields
			}
		});
	} catch (error) {
		console.error('Auth check error:', error);
		return json({ success: false }, { status: 500 });
	}
};
