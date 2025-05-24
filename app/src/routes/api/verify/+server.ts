import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import type { Cookies } from '@sveltejs/kit';

// Helper function to update auth cookie
function updateAuthCookie(cookies: Cookies): void {
	if (pbServer.pb.authStore.isValid) {
		cookies.set(
			'pb_auth',
			JSON.stringify({
				token: pbServer.pb.authStore.token,
				model: pbServer.pb.authStore.model
			}),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			}
		);
	}
}
interface AuthModelData {
	id?: string;
	email?: string;
	username?: string;
	name?: string;
	avatar?: string;
	collectionId?: string;
	created?: string;
	updated?: string;
	selected_provider?: string;
	model?: string;
	prompt_preference?: string[];
	sysprompt_preference?: string;
	model_preference?: string[];
}
function sanitizeUserData(user: AuthModelData | null): Partial<User> | null {
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
		model_preference: user.model_preference
	};
}
async function getUserCount(): Promise<number> {
	try {
		const resultList = await pbServer.pb.collection('users').getList(1, 1, {
			sort: '-created'
		});
		return resultList.totalItems;
	} catch (error) {
		console.error('Error fetching user count:', error);
		return 0;
	}
}

// Handle GET requests
export const GET: RequestHandler = async ({ url, cookies }) => {
	console.log('GET request to', url.pathname);

	// Support query param based check endpoints
	const check = url.searchParams.get('check');

	// Health check via query param
	if (check === 'health') {
		try {
			const isHealthy = await pbServer.checkPocketBaseConnection();
			return json({
				success: isHealthy,
				message: isHealthy ? 'PocketBase is healthy' : 'PocketBase is not healthy'
			});
		} catch (error) {
			console.error('PocketBase health check failed:', error);
			return json({ success: false, error: 'PocketBase connection failed' }, { status: 500 });
		}
	}

	// Restore auth from cookies if available
	const authCookie = cookies.get('pb_auth');
	if (authCookie) {
		try {
			const authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch (e) {
			console.error('Error parsing auth cookie:', e);
		}
	}

	// Extract the path after /api/verify/
	const pathParts = url.pathname.split('/');
	const apiIndex = pathParts.indexOf('api');
	const verifyIndex = pathParts.indexOf('verify');

	if (apiIndex === -1 || verifyIndex === -1 || verifyIndex !== apiIndex + 1) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	// The remainder is the actual endpoint we want to handle
	const endpoint = pathParts.slice(verifyIndex + 1).join('/');
	console.log('Endpoint:', endpoint);

	// Health check endpoint via path
	if (endpoint === 'health') {
		try {
			const isHealthy = await pbServer.checkPocketBaseConnection();
			return json({
				success: isHealthy,
				message: isHealthy ? 'PocketBase is healthy' : 'PocketBase is not healthy'
			});
		} catch (error) {
			console.error('PocketBase health check failed:', error);
			return json({ success: false, error: 'PocketBase connection failed' }, { status: 500 });
		}
	}

	// Auth check endpoint
	if (endpoint === 'auth-check') {
		console.log('=== AUTH CHECK ===');
		console.log('Auth cookie exists:', !!authCookie);
		console.log('Auth store valid before check:', pbServer.pb.authStore.isValid);

		if (!authCookie) {
			console.log('No auth cookie found');
			return json({ success: false, error: 'No authentication cookie found' }, { status: 401 });
		}

		try {
			// Try to parse and check the auth data structure before auth check
			try {
				const authData = JSON.parse(authCookie);
				if (!authData.token || !authData.model) {
					console.log('Invalid auth data structure in cookie');
					return json({ success: false, error: 'Invalid auth data' }, { status: 401 });
				}

				// Clear and reload auth to ensure we're using the cookie data
				pbServer.pb.authStore.clear();
				pbServer.pb.authStore.save(authData.token, authData.model);

				console.log('Auth data loaded from cookie, valid:', pbServer.pb.authStore.isValid);
			} catch (parseError) {
				console.error('Error parsing auth cookie:', parseError);
				cookies.delete('pb_auth', { path: '/' });
				return json({ success: false, error: 'Invalid auth cookie format' }, { status: 401 });
			}

			// Now check authentication
			const isAuthenticated = await pbServer.ensureAuthenticated();
			console.log('ensureAuthenticated result:', isAuthenticated);

			if (isAuthenticated) {
				// Update the cookie with refreshed token if needed
				updateAuthCookie(cookies);

				// Return user data
				return json({
					success: true,
					user: sanitizeUserData(pbServer.pb.authStore.model),
					token: pbServer.pb.authStore.token
				});
			} else {
				// Clear invalid cookie
				cookies.delete('pb_auth', { path: '/' });
				return json({ success: false, error: 'Authentication failed' }, { status: 401 });
			}
		} catch (error) {
			console.error('Auth check error:', error);
			// Clear potentially corrupted cookie
			cookies.delete('pb_auth', { path: '/' });
			return json({ success: false, error: 'Authentication check failed' }, { status: 500 });
		}
	}

	// User count endpoint
	if (endpoint === 'users/count') {
		try {
			const count = await getUserCount();
			return json({ success: true, count });
		} catch (error) {
			console.error('Error fetching user count:', error);
			return json({ success: false, error: 'Failed to get user count' }, { status: 400 });
		}
	}

	// Handle user endpoints
	const userMatch = /^users\/([^/]+)(?:\/(.+))?$/.exec(endpoint);
	if (userMatch) {
		const userId = userMatch[1];
		const action = userMatch[2];

		if (action === 'public') {
			try {
				const userData = await pbServer.getPublicUserData(userId);
				return json({ success: true, user: userData });
			} catch (error) {
				console.error('Error fetching public user data:', error);
				return json({ success: false, error: 'Failed to get public user data' }, { status: 400 });
			}
		} else if (!action) {
			try {
				const userData = await pbServer.getUserById(userId);
				return json({ success: true, user: userData });
			} catch (error) {
				console.error('Error fetching user:', error);
				return json({ success: false, error: 'Failed to get user' }, { status: 400 });
			}
		}
	}

	console.log('No matching route for GET', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};

// Handle POST requests
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	console.log('POST request to', url.pathname);

	// Restore auth from cookies if available
	const authCookie = cookies.get('pb_auth');
	if (authCookie) {
		try {
			const authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch (e) {
			console.error('Error parsing auth cookie:', e);
		}
	}

	// Extract the path after /api/verify/
	const pathParts = url.pathname.split('/');
	const apiIndex = pathParts.indexOf('api');
	const verifyIndex = pathParts.indexOf('verify');

	if (apiIndex === -1 || verifyIndex === -1 || verifyIndex !== apiIndex + 1) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	// The remainder is the actual endpoint we want to handle
	const endpoint = pathParts.slice(verifyIndex + 1).join('/');
	console.log('Endpoint:', endpoint);

	// Sign up endpoint
	if (endpoint === 'signup') {
		try {
			const { email, password } = await request.json();

			const user = await pbServer.signUp(email, password);
			if (!user) {
				return json({ success: false, error: 'Failed to create user' }, { status: 400 });
			}

			// Automatically sign in after successful signup
			const authData = await pbServer.signIn(email, password);

			// Save auth to cookies
			updateAuthCookie(cookies);

			return json({
				success: true,
				user: sanitizeUserData(user),
				authData
			});
		} catch (error) {
			console.error('Sign-up error:', error);
			return json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Sign-up failed'
				},
				{ status: 400 }
			);
		}
	}

	// Sign in endpoint
	if (endpoint === 'signin') {
		try {
			const { email, password } = await request.json();

			const authData = await pbServer.signIn(email, password);
			if (!authData) {
				return json({ success: false, error: 'Authentication failed' }, { status: 401 });
			}

			// Save auth to cookies
			updateAuthCookie(cookies);

			return json({
				success: true,
				user: sanitizeUserData(pbServer.pb.authStore.model as User),
				authData
			});
		} catch (error) {
			console.error('Sign-in error:', error);
			return json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Authentication failed'
				},
				{ status: 401 }
			);
		}
	}

	// Sign out endpoint
	if (endpoint === 'signout') {
		pbServer.signOut();
		cookies.delete('pb_auth', { path: '/' });
		return json({ success: true });
	}

	console.log('No matching route for POST', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};

// Handle PATCH requests
export const PATCH: RequestHandler = async ({ request, url, cookies }) => {
	console.log('PATCH request to', url.pathname);

	// Restore auth from cookies if available
	const authCookie = cookies.get('pb_auth');
	if (authCookie) {
		try {
			const authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch (e) {
			console.error('Error parsing auth cookie:', e);
		}
	}

	// Extract the path after /api/verify/
	const pathParts = url.pathname.split('/');
	const apiIndex = pathParts.indexOf('api');
	const verifyIndex = pathParts.indexOf('verify');

	if (apiIndex === -1 || verifyIndex === -1 || verifyIndex !== apiIndex + 1) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	// The remainder is the actual endpoint we want to handle
	const endpoint = pathParts.slice(verifyIndex + 1).join('/');
	console.log('Endpoint:', endpoint);

	// Handle user update
	const userMatch = /^users\/([^/]+)$/.exec(endpoint);
	if (userMatch) {
		const userId = userMatch[1];
		try {
			let userData;

			// Handle both FormData and JSON
			const contentType = request.headers.get('content-type');
			if (contentType && contentType.includes('multipart/form-data')) {
				userData = await request.formData();
			} else {
				userData = await request.json();
			}

			const updatedUser = await pbServer.updateUser(userId, userData);

			// Update the cookie if it's the current user
			if (pbServer.pb.authStore.model?.id === userId) {
				updateAuthCookie(cookies);
			}

			return json({
				success: true,
				user: sanitizeUserData(updatedUser)
			});
		} catch (error) {
			console.error('Error updating user:', error);
			return json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Failed to update user'
				},
				{ status: 400 }
			);
		}
	}

	console.log('No matching route for PATCH', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};
