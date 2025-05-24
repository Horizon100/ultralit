// src/routes/api/test/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	console.log('Test endpoint called');
	console.log('Auth status:', locals.user ? 'Authenticated' : 'Not authenticated');

	return json({
		success: true,
		message: 'Test endpoint working',
		authStatus: locals.user ? 'authenticated' : 'not authenticated',
		userId: locals.user?.id || null
	});
};
