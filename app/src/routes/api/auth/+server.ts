// src/routes/api/auth/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies }) =>
	apiTryCatch(
		async () => {
			const { email, password } = await request.json();

			const authResult = await pbTryCatch(
				pb.collection('users').authWithPassword(email, password),
				'authenticate user'
			);
			const authData = unwrap(authResult);

			cookies.set('pb_auth', pb.authStore.exportToCookie(), {
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax'
			});

			return { success: true, user: authData.record };
		},
		'Invalid credentials',
		401
	);
