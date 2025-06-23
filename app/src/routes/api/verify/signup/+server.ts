import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch, validationTryCatch, pbTryCatch, isFailure } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies }) => {
	return apiTryCatch(async () => {
		const requestBody = await request.json();

		// Validate input data
		const validationResult = validationTryCatch(() => {
			const { email, password } = requestBody;

			// Validate required fields
			if (!email || !password) {
				throw new Error('Email and password are required');
			}

			if (typeof email !== 'string' || typeof password !== 'string') {
				throw new Error('Email and password must be strings');
			}

			// Validate email format
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
				throw new Error('Invalid email format');
			}

			// Validate password strength
			if (password.length < 8) {
				throw new Error('Password must be at least 8 characters');
			}

			return { email, password };
		}, 'signup data');
		
		if (isFailure(validationResult)) {
			throw new Error(validationResult.error);
		}

		const { email, password } = validationResult.data;

		// Create user with PocketBase error handling
		const createResult = await pbTryCatch(
			pbServer.pb.collection('users').create({
				email,
				password,
				passwordConfirm: password,
				emailVisibility: true
			}),
			'create user'
		);

		if (isFailure(createResult)) {
			throw new Error(createResult.error);
		}

		const user = createResult.data;

		// Authenticate user with PocketBase error handling
		const authResult = await pbTryCatch(
			pbServer.pb.collection('users').authWithPassword(email, password),
			'authenticate new user'
		);

		if (isFailure(authResult)) {
			throw new Error(authResult.error);
		}

		const authData = authResult.data;

		// Set auth cookie
		cookies.set('pb_auth', pbServer.pb.authStore.exportToCookie(), {
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		return {
			success: true,
			user: {
				id: user.id,
				email: user.email,
				// Include other safe fields as needed
			},
			token: authData.token
		};
	}, 'Sign-up failed', 400);
};