import { pb } from '$lib/server/pocketbase';
import { userSchema, sanitizeInput } from '$lib/validation';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) =>
	apiTryCatch(
		async () => {
			const clientIP = getClientAddress();

			let body;
			try {
				body = await request.json();
			} catch {
				throw new Error('Invalid JSON');
			}

			// Validate and sanitize input
			const { email, password } = userSchema.parse({
				email: sanitizeInput(body.email || ''),
				password: body.password || ''
			});

			// Additional security: Check for suspicious patterns
			if (!email || !password) {
				console.warn(`[SECURITY] Empty credentials from IP: ${clientIP}`);
				throw new Error('Invalid credentials');
			}

			const authResult = await pbTryCatch(
				pb.collection('users').authWithPassword(email, password),
				'authenticate user'
			);
			const authData = unwrap(authResult);

			// Set secure cookie
			cookies.set('pb_auth', pb.authStore.exportToCookie(), {
				path: '/',
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				httpOnly: true,
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});

			// Don't return sensitive data
			const { password: _, ...safeUser } = authData.record;
			return { success: true, user: safeUser };
		},
		'Invalid credentials',
		401
	);
