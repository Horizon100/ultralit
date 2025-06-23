// src/routes/api/verify/signin/+server.ts - Optimized
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';

// Cache sanitized user data function
const sanitizeUserData = (user: User | null): Partial<User> | null => {
	if (!user) return null;
	return {
		id: user.id,
		email: user.email,
		username: user.username,
		name: user.name,
		avatar: user.avatar,
		collectionId: user.collectionId,
		created: user.created,
		updated: user.updated,
		selected_provider: user.selected_provider,
		model: user.model,
		prompt_preference: user.prompt_preference,
		sysprompt_preference: user.sysprompt_preference,
		model_preference: user.model_preference,
		wallpaper_preference: user.wallpaper_preference
	};
};

const createMinimalAuthData = (authStore: any) => {
	return {
		token: authStore.token,
		// Only store essential user fields to keep cookie size down
		model: {
			id: authStore.model?.id,
			email: authStore.model?.email,
			username: authStore.model?.username,
			name: authStore.model?.name,
			collectionId: authStore.model?.collectionId
			// DO NOT include arrays like prompt_preference, model_preference - they make cookie too large!
		}
	};
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		console.log('=== SIGNIN DEBUG ===');
		console.log('Email:', email);
		console.log('Password provided:', !!password);

		if (!email || !password) {
			return json(
				{
					success: false,
					error: 'Email and password are required'
				},
				{ status: 400 }
			);
		}

		console.log('Attempting authentication with PocketBase...');

		// Direct authentication without preliminary health check
		const authData = await pb.collection('users').authWithPassword<User>(email, password);

		console.log('✅ Authentication successful!');
		console.log('User ID:', authData.record.id);

		// Create minimal auth data for cookie (this is the key fix!)
		const minimalAuthData = createMinimalAuthData(pb.authStore);
		const authCookieValue = JSON.stringify(minimalAuthData);

		// Check cookie size before setting (optional debugging)
		const cookieSize = new Blob([authCookieValue]).size;
		console.log('Auth cookie size:', cookieSize, 'bytes');

		if (cookieSize > 3500) {
			// Warning if approaching 4KB limit
			console.warn('⚠️ Auth cookie is getting large:', cookieSize, 'bytes');
		}

		// Set auth cookie with optimized settings
		const cookieOptions = {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax' as const,
			path: '/',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		};

		// Store minimal auth data in cookie
		cookies.set('pb_auth', authCookieValue, cookieOptions);

		return json({
			success: true,
			user: sanitizeUserData(authData.record), // Full user data in response
			token: pb.authStore.token
		});
	} catch (error) {
		console.error('=== SIGNIN ERROR ===');

		// Clear any existing auth cookie on error
		cookies.delete('pb_auth', { path: '/' });

		if (error instanceof Error) {
			console.error('Error message:', error.message);

			// Handle specific PocketBase errors more gracefully
			if (error.message.includes('Failed to authenticate')) {
				return json(
					{
						success: false,
						error: 'Invalid email or password'
					},
					{ status: 401 }
				);
			}

			// Handle cookie size errors
			if (error.message.includes('too large')) {
				return json(
					{
						success: false,
						error: 'Session data too large. Please contact support.'
					},
					{ status: 500 }
				);
			}
		}

		console.error('Full error:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Authentication failed'
			},
			{ status: 401 }
		);
	}
};
