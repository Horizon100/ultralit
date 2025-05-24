// src/hooks.server.ts
import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import type { Handle } from '@sveltejs/kit';

// Only refresh auth token if it will expire soon
const TOKEN_REFRESH_THRESHOLD = 10 * 60; // 10 minutes in seconds

export const handle: Handle = async ({ event, resolve }) => {
	// Load the auth store from request cookie
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

	try {
		// Only refresh if token is valid but about to expire
		if (pb.authStore.isValid) {
			// Check if we need to refresh the token
			const tokenExpiry = pb.authStore.model?.exp || 0;
			const currentTime = Math.floor(Date.now() / 1000);
			const timeUntilExpiry = tokenExpiry - currentTime;

			console.log(`Auth token expires in ${timeUntilExpiry} seconds`);

			if (timeUntilExpiry > 0 && timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
				console.log('Refreshing auth token...');
				await pb.collection('users').authRefresh();
				console.log('Auth token refreshed successfully');
			}
		}
	} catch (error) {
		console.error('Auth refresh error:', error);
		// Clear the auth store if refresh fails
		pb.authStore.clear();
	}

	// Add pb and user to locals
	event.locals.pb = pb;
	event.locals.user = pb.authStore.model ? (structuredClone(pb.authStore.model) as User) : null;

	// Log authentication status for debugging
	console.log(
		`Request to ${event.url.pathname} - Auth status: ${pb.authStore.isValid ? 'Authenticated' : 'Not authenticated'}`
	);
	if (pb.authStore.isValid) {
		console.log(`User: ${pb.authStore.model?.id}`);
	}

	const response = await resolve(event);

	// Set the cookie in the response only if we have a valid auth
	if (pb.authStore.isValid) {
		response.headers.set(
			'set-cookie',
			pb.authStore.exportToCookie({
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'Lax',
				httpOnly: true,
				path: '/'
			})
		);
	}

	return response;
};
