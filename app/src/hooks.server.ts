// src/hooks.server.ts
import { pb } from '$lib/server/pocketbase'; // Use the server singleton
import type { User } from '$lib/types/types';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Load the auth store from request cookie
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

	// Add pb and user to locals
	event.locals.pb = pb;
	event.locals.user = pb.authStore.model ? (structuredClone(pb.authStore.model) as User) : null;

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