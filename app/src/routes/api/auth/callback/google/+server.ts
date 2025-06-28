import { pb } from '$lib/server/pocketbase';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, cookies }) =>
	apiTryCatch(
		async () => {
			try {
				const code = url.searchParams.get('code');
				const state = url.searchParams.get('state');

				if (!code || !state) throw new Error('Missing OAuth parameters');

				const redirectUrl = `${url.origin}/api/auth/callback/google`;

				await pb.collection('users').authWithOAuth2({
					provider: 'google',
					code,
					state,
					redirectUrl
				});

				cookies.set('pb_auth', pb.authStore.token, {
					path: '/',
					httpOnly: true,
					secure: url.protocol === 'https:',
					maxAge: 60 * 60 * 24 * 30
				});

				throw redirect(303, '/home');
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				console.error('OAuth callback error:', error);
				throw redirect(303, '/login?error=auth_failed&details=' + encodeURIComponent(errorMessage));
			}
		},
		'OAuth callback failed',
		500
	);
