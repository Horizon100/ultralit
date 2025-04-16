// src/hooks.server.ts
import { pb } from '$lib/server/pocketbase';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Load the auth store from request cookie
  pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');
  
  try {
    // Refresh the auth model if valid
    if (pb.authStore.isValid) {
      await pb.collection('users').authRefresh();
    }
  } catch (_) {
    // Clear the auth store if refresh fails
    pb.authStore.clear();
  }

  // Add pb and user to locals
  event.locals.pb = pb;
  event.locals.user = pb.authStore.model ? structuredClone(pb.authStore.model) : null;

  const response = await resolve(event);

  // Set the cookie in the response
  response.headers.set('set-cookie', pb.authStore.exportToCookie({ secure: false }));

  return response;
};