// src/routes/api/oauth2-redirect/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, cookies }) => {
	return apiTryCatch(
		async () => {
			console.log('OAuth2 redirect handler called');
			console.log('URL params:', Object.fromEntries(url.searchParams.entries()));

			// Get the query parameters from the redirect
			const code = url.searchParams.get('code');
			const state = url.searchParams.get('state');
			const error = url.searchParams.get('error');

			if (error) {
				console.error('OAuth error:', error);
				throw new Error(`OAuth error: ${error}`);
			}

			if (!code || !state) {
				console.error('Missing required OAuth parameters:', { code, state });
				throw new Error('Missing required OAuth parameters');
			}

			console.log('Completing OAuth authentication...');
			const authData = await pb
				.collection('users')
				.authWithOAuth2Code('google', code, state, url.origin);

			console.log('OAuth authentication successful:', !!authData);

			// Set the auth cookie
			cookies.set(
				'pb_auth',
				JSON.stringify({
					token: pb.authStore.token,
					model: pb.authStore.model
				}),
				{
					path: '/',
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					maxAge: 60 * 60 * 24 * 30, // 30 days
					sameSite: 'lax'
				}
			);

			// Return redirect info to handle after the wrapper returns
			return redirect(302, '/dashboard');
		},
		'OAuth2 redirect handler error',
		302
	); // Use 302 for redirect errors
};
