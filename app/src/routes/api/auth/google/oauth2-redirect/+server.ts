import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url }) =>
	apiTryCatch(async () => {
		console.log('Starting Google auth flow...');

		const authMethods = await pb.collection('users').listAuthMethods();

		const googleProvider = authMethods.authProviders.find((p) => p.name === 'google');

		if (!googleProvider) {
			throw new Error('Google authentication provider not found');
		}

		const authUrl = new URL(googleProvider.authUrl);

		console.log('Original URL parameters:');
		authUrl.searchParams.forEach((value, key) => {
			console.log(`${key}: ${value}`);
		});

		if (!authUrl.searchParams.has('redirect_uri')) {
			console.log('redirect_uri is missing, setting it manually');

			if (url.hostname === 'localhost') {
				authUrl.searchParams.set('redirect_uri', 'http://127.0.0.1:8090/api/oauth2-redirect');
			} else {
				authUrl.searchParams.set('redirect_uri', 'https://vrazum.com/api/oauth2-redirect');
			}
		}

		console.log('Final Google Auth URL:', authUrl.toString());

		return {
			authUrl: authUrl.toString()
		};
	}, 'Google authentication error', 500);