//  src/routes/api/verify/signup/+server.ts

import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch, validationTryCatch, pbTryCatch, isFailure } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async ({ request, cookies }) => {
	return apiTryCatch(
		async () => {
			const requestBody = await request.json();
			console.log('Signup request body:', requestBody);

			const validationResult = validationTryCatch(() => {
				const { email, password, securityQuestion, securityAnswer } = requestBody;

				// Validate required fields
				if (!email || !password) {
					throw new Error('Email and password are required');
				}

				if (typeof email !== 'string' || typeof password !== 'string') {
					throw new Error('Email and password must be strings');
				}

				if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
					throw new Error('Invalid email format');
				}

				if (password.length < 8) {
					throw new Error('Password must be at least 8 characters');
				}

				if (securityQuestion && typeof securityQuestion !== 'string') {
					throw new Error('Security question must be a string');
				}

				if (securityAnswer && typeof securityAnswer !== 'string') {
					throw new Error('Security answer must be a string');
				}

				return { email, password, securityQuestion, securityAnswer };
			}, 'signup data');

			if (isFailure(validationResult)) {
				throw new Error(validationResult.error);
			}

			const { email, password, securityQuestion, securityAnswer } = validationResult.data;

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
			console.log('User created:', user.id);

			// Save security information if provided
			if (securityQuestion && securityAnswer) {
				console.log('Saving security info for user:', user.id);

				const securityResult = await pbTryCatch(
					pbServer.pb.collection('users_security').create({
						user: user.id,
						securityQuestion,
						securityAnswer: securityAnswer.toLowerCase().trim()
					}),
					'create security record'
				);

				if (isFailure(securityResult)) {
					console.error('Failed to save security info:', securityResult.error);
				} else {
					console.log('Security info saved successfully');
				}
			}

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
					email: user.email
				},
				token: authData.token
			};
		},
		'Sign-up failed',
		400
	);
};
