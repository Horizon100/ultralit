// src/routes/api/auth/google/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		console.log('Starting Google auth flow...');

		// Get auth methods from PocketBase
		const authMethods = await pb.collection('users').listAuthMethods();

		// Find Google provider
		const googleProvider = authMethods.authProviders.find((provider) => provider.name === 'google');

		if (!googleProvider) {
			return json(
				{
					success: false,
					error: 'Google authentication provider not found'
				},
				{ status: 400 }
			);
		}

		// Get the original auth URL from PocketBase
		const authUrl = new URL(googleProvider.authUrl);

		// Log the original URL parameters for debugging
		console.log('Original URL parameters:');
		authUrl.searchParams.forEach((value, key) => {
			console.log(`${key}: ${value}`);
		});

		// Check if redirect_uri is present
		if (!authUrl.searchParams.has('redirect_uri')) {
			console.log('redirect_uri is missing, setting it manually');

			// For development on localhost
			if (url.hostname === 'localhost') {
				authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:8090/api/oauth2-redirect');
			} else {
				// For production
				authUrl.searchParams.set('redirect_uri', 'https://vrazum.com/api/oauth2-redirect');
			}
		}

		// Log the final URL for debugging
		console.log('Final Google Auth URL:', authUrl.toString());

		// Return the modified authorization URL
		return json({
			success: true,
			authUrl: authUrl.toString()
		});
	} catch (error) {
		console.error('Google authentication error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Authentication failed'
			},
			{ status: 500 }
		);
	}
};
