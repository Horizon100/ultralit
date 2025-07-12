import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import type { Handle } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/validation';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	const clientIP = event.getClientAddress();

	console.log('🔗 Hook processing:', {
		method: event.request.method,
		path: event.url.pathname,
		hasAuthHeader: !!event.request.headers.get('cookie')
	});

	// Rate limiting for API endpoints (skip debug endpoints in development)
	if (event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/debug/')) {
		// Different limits for different endpoints
		let maxRequests = 60;
		let windowMs = 60000; // 1 minute

		if (event.url.pathname.includes('/auth')) {
			maxRequests = 5;
			windowMs = 300000; // 5 minutes for auth
		} else if (event.url.pathname.includes('/ai/')) {
			maxRequests = 10;
			windowMs = 60000;
		}

		if (!checkRateLimit(clientIP, event.url.pathname, maxRequests, windowMs)) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	// Initialize locals
	event.locals.pb = pb;
	event.locals.user = null;

	// Get the cookie header (declare outside try block so it's accessible later)
	const cookieHeader = event.request.headers.get('cookie') || '';
	console.log('🍪 Cookie header exists:', !!cookieHeader);

	if (cookieHeader) {
		console.log('🍪 Cookie header content:', cookieHeader);
	}

	try {
		// Load the auth store from request cookie
		pb.authStore.loadFromCookie(cookieHeader);

		console.log('🔐 After loading cookie - authStore valid:', pb.authStore.isValid);
		console.log('🔐 AuthStore token exists:', !!pb.authStore.token);
		console.log('🔐 AuthStore model exists:', !!pb.authStore.model);

		// Verify the auth token if it exists
		if (pb.authStore.isValid && pb.authStore.model) {
			try {
				console.log('🔄 Attempting auth refresh...');
				// Refresh the auth token to ensure it's still valid
				await pb.collection('users').authRefresh();
				console.log('✅ Auth refresh successful');

				if (pb.authStore.model) {
					event.locals.user = structuredClone(pb.authStore.model) as User;
					console.log('👤 User set in locals:', {
						id: event.locals.user.id,
						email: event.locals.user.email,
						username: event.locals.user.username
					});
				}
			} catch (error) {
				console.error('❌ Auth refresh failed:', error);
				// Clear invalid auth
				pb.authStore.clear();
				event.locals.user = null;
			}
		} else {
			console.log('🚫 No valid auth found');
		}
	} catch (authError) {
		console.error('❌ Auth processing error:', authError);
		pb.authStore.clear();
		event.locals.user = null;
	}

	console.log('🏁 Final locals.user:', {
		exists: !!event.locals.user,
		id: event.locals.user?.id
	});

	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	// CSP for production
	if (!dev) {
		response.headers.set(
			'Content-Security-Policy',
			"default-src 'self'; " +
				"script-src 'self' 'unsafe-inline'; " +
				"style-src 'self' 'unsafe-inline'; " +
				"img-src 'self' data: https:; " +
				"connect-src 'self' " +
				process.env.VITE_POCKETBASE_URL +
				';'
		);
	}

	// Handle cookie setting more carefully
	try {
		if (pb.authStore.isValid && pb.authStore.token) {
			const authCookie = pb.authStore.exportToCookie({
				secure: !dev, // Use secure in production
				sameSite: 'Lax',
				httpOnly: true,
				path: '/',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});

			console.log('🍪 Setting auth cookie');
			response.headers.set('set-cookie', authCookie);
		} else if (cookieHeader && cookieHeader.includes('pb_auth')) {
			// Only clear the cookie if it exists and auth is invalid
			console.log('🗑️ Clearing invalid auth cookie');
			response.headers.set('set-cookie', 'pb_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
		}
	} catch (cookieError) {
		console.error('❌ Cookie handling error:', cookieError);
	}

	return response;
};
