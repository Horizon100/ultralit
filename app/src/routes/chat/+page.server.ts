// src/routes/chat/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	console.log('Chat page server load called');
	console.log('Locals user:', locals.user);
	console.log('Auth cookie exists:', !!cookies.get('pb_auth'));

	// Check if user is authenticated via locals (set by hooks.server.ts)
	if (!locals.user) {
		console.log('No user found, redirecting to home');
		throw redirect(302, '/');
	}

	// Get URL parameters for thread, message, model etc.
	const threadId = url.searchParams.get('thread');
	const messageId = url.searchParams.get('message');
	const modelId = url.searchParams.get('model');

	console.log('Chat page loaded successfully for user:', locals.user.id);

	return {
		user: locals.user,
		threadId,
		messageId,
		modelId,
		threadData: null,
		messageData: null
	};
};
