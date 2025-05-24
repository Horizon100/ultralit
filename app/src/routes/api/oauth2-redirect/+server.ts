// src/routes/api/oauth2-redirect/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, cookies }) => {
	try {
		console.log('OAuth2 redirect handler called');
		console.log('URL params:', Object.fromEntries(url.searchParams.entries()));

		// Get the query parameters from the redirect
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const error = url.searchParams.get('error');

		// Handle error from OAuth provider
		if (error) {
			console.error('OAuth error:', error);
			return redirect(302, '/?authError=' + encodeURIComponent(error));
		}

		// Validate required parameters
		if (!code || !state) {
			console.error('Missing required OAuth parameters:', { code, state });
			return redirect(302, '/?authError=missing_parameters');
		}

		// Complete the OAuth flow using PocketBase
		try {
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

			// Redirect to the dashboard or homepage
			return redirect(302, '/dashboard');
		} catch (authError) {
			console.error('Error completing OAuth flow:', authError);
			return redirect(302, '/?authError=' + encodeURIComponent('authentication_failed'));
		}
	} catch (error) {
		console.error('OAuth redirect handler error:', error);
		return redirect(302, '/?authError=server_error');
	}
};
