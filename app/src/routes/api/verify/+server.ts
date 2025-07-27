import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import type { Cookies } from '@sveltejs/kit';
import {
	apiTryCatch,
	pbTryCatch,
	tryCatchSync,
	validationTryCatch,
	isSuccess,
	isFailure,
	unwrap
} from '$lib/utils/errorUtils';

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
				sameSite: 'lax',
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
	const result = await pbTryCatch(
		pbServer.pb.collection('users').getList(1, 1, {
			sort: '-created'
		}),
		'fetch user count'
	);

	if (isFailure(result)) {
		return 0;
	}

	return result.data.totalItems;
}

function parseAuthCookie(authCookie: string | undefined): { token: string; model: null } | null {
	if (!authCookie) return null;

	const result = tryCatchSync(() => {
		const authData = JSON.parse(authCookie);
		if (!authData.token || !authData.model) {
			throw new Error('Invalid auth data structure');
		}
		return authData;
	});

	return isSuccess(result) ? result.data : null;
}

function extractEndpoint(url: URL): string | null {
	const pathParts = url.pathname.split('/');
	const apiIndex = pathParts.indexOf('api');
	const verifyIndex = pathParts.indexOf('verify');

	if (apiIndex === -1 || verifyIndex === -1 || verifyIndex !== apiIndex + 1) {
		return null;
	}

	return pathParts.slice(verifyIndex + 1).join('/');
}

// Handle GET requests
export const GET: RequestHandler = async ({ url, cookies }) => {
	console.log('GET request to', url.pathname);

	const endpoint = extractEndpoint(url);
	if (!endpoint) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	console.log('Endpoint:', endpoint);

	// Support query param based check endpoints
	const check = url.searchParams.get('check');

	// Health check via query param or path
	if (check === 'health' || endpoint === 'health') {
		return apiTryCatch(
			pbServer.checkPocketBaseConnection().then((isHealthy) => ({
				success: isHealthy,
				message: isHealthy ? 'PocketBase is healthy' : 'PocketBase is not healthy'
			})),
			'PocketBase health check failed'
		);
	}

	// Auth check endpoint
	if (endpoint === 'auth-check') {
		return apiTryCatch(
			async () => {
				console.log('=== AUTH CHECK ===');

				const authCookie = cookies.get('pb_auth');
				console.log('Auth cookie exists:', !!authCookie);

				if (!authCookie) {
					console.log('No auth cookie found');
					throw new Error('No authentication cookie found');
				}

				const authData = parseAuthCookie(authCookie);
				if (!authData) {
					console.log('Invalid auth data structure in cookie');
					cookies.delete('pb_auth', { path: '/' });
					throw new Error('Invalid auth cookie format');
				}

				// Clear and reload auth to ensure we're using the cookie data
				pbServer.pb.authStore.clear();
				pbServer.pb.authStore.save(authData.token, authData.model);

				console.log('Auth data loaded from cookie, valid:', pbServer.pb.authStore.isValid);

				// Check authentication
				const isAuthenticated = await pbServer.ensureAuthenticated();
				console.log('ensureAuthenticated result:', isAuthenticated);

				if (!isAuthenticated) {
					cookies.delete('pb_auth', { path: '/' });
					throw new Error('Authentication failed');
				}

				// Update the cookie with refreshed token if needed
				updateAuthCookie(cookies);

				return {
					success: true,
					user: sanitizeUserData(pbServer.pb.authStore.model),
					token: pbServer.pb.authStore.token
				};
			},
			'Authentication check failed',
			401
		);
	}

	// User count endpoint
	if (endpoint === 'users/count') {
		return apiTryCatch(async () => {
			const count = await getUserCount();
			return { success: true, count };
		}, 'Failed to get user count');
	}

	// Handle user endpoints
	const userMatch = /^users\/([^/]+)(?:\/(.+))?$/.exec(endpoint);
	if (userMatch) {
		const userId = userMatch[1];
		const action = userMatch[2];

		if (action === 'public') {
			return apiTryCatch(async () => {
				const userData = await pbServer.getPublicUserData(userId);
				return { success: true, user: userData };
			}, 'Failed to get public user data');
		} else if (!action) {
			// FIX: Use the same pattern as your individual user endpoint
			return apiTryCatch(async () => {
				const userResult = await pbTryCatch(
					pbServer.pb.collection('users').getOne(userId),
					'fetch user'
				);
				const user = unwrap(userResult);

				// Use the same sanitizeUser function from your individual endpoint
				const sanitizedUser = {
					id: user.id,
					name: user.name || '',
					username: user.username || '',
					email: user.email || '',
					description: user.description || '',
					role: user.role || '',
					created: user.created || '',
					updated: user.updated || '',
					verified: user.verified || false,
					theme_preference: user.theme_preference || '',
					wallpaper_preference: user.wallpaper_preference || '',
					model: user.model || null,
					selected_provider: user.selected_provider || null,
					prompt_preference: user.prompt_preference || '',
					sysprompt_preference: user.sysprompt_preference || '',
					model_preference: user.model_preference
				};

				return { success: true, user: sanitizedUser };
			}, 'Failed to get user');
		}
	}

	console.log('No matching route for GET', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};

// Handle POST requests
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	console.log('POST request to', url.pathname);

	const endpoint = extractEndpoint(url);
	if (!endpoint) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	console.log('Endpoint:', endpoint);

	// Restore auth from cookies if available
	const authCookie = cookies.get('pb_auth');
	const authData = parseAuthCookie(authCookie);
	if (authData) {
		pbServer.pb.authStore.save(authData.token, authData.model);
	}

	// Sign up endpoint
	if (endpoint === 'signup') {
		return apiTryCatch(
			async () => {
				const body = await request.json();

				const validationResult = validationTryCatch(() => {
					if (!body.email || !body.password) {
						throw new Error('Email and password are required');
					}

					if (typeof body.email !== 'string' || typeof body.password !== 'string') {
						throw new Error('Email and password must be strings');
					}

					// Validate email format
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
						throw new Error('Invalid email format');
					}

					// Validate password strength
					if (body.password.length < 8) {
						throw new Error('Password must be at least 8 characters');
					}

					return { email: body.email, password: body.password };
				}, 'signup credentials');

				if (isFailure(validationResult)) {
					throw new Error(validationResult.error);
				}

				const { email, password } = validationResult.data;

				const user = await pbServer.signUp(email, password);
				if (!user) {
					throw new Error('Failed to create user');
				}

				// Automatically sign in after successful signup
				const authData = await pbServer.signIn(email, password);

				// Save auth to cookies
				updateAuthCookie(cookies);

				return {
					success: true,
					user: sanitizeUserData(user),
					authData
				};
			},
			'Sign-up failed',
			400
		);
	}

	// Sign in endpoint
	if (endpoint === 'signin') {
		return apiTryCatch(
			async () => {
				const body = await request.json();

				const validationResult = validationTryCatch(() => {
					if (!body.email || !body.password) {
						throw new Error('Email and password are required');
					}

					if (typeof body.email !== 'string' || typeof body.password !== 'string') {
						throw new Error('Email and password must be strings');
					}

					return { email: body.email, password: body.password };
				}, 'signin credentials');

				if (isFailure(validationResult)) {
					throw new Error(validationResult.error);
				}

				const { email, password } = validationResult.data;

				const authData = await pbServer.signIn(email, password);
				if (!authData) {
					throw new Error('Authentication failed');
				}

				// Save auth to cookies
				updateAuthCookie(cookies);

				return {
					success: true,
					user: sanitizeUserData(pbServer.pb.authStore.model as User),
					authData
				};
			},
			'Authentication failed',
			401
		);
	}

	// Sign out endpoint
	if (endpoint === 'signout') {
		return apiTryCatch(async () => {
			pbServer.signOut();
			cookies.delete('pb_auth', { path: '/' });
			return { success: true };
		}, 'Sign out failed');
	}

	console.log('No matching route for POST', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};

// Handle PATCH requests
export const PATCH: RequestHandler = async ({ request, url, cookies }) => {
	console.log('PATCH request to', url.pathname);

	const endpoint = extractEndpoint(url);
	if (!endpoint) {
		return json({ success: false, error: 'Invalid API path' }, { status: 404 });
	}

	console.log('Endpoint:', endpoint);

	// Restore auth from cookies if available
	const authCookie = cookies.get('pb_auth');
	const authData = parseAuthCookie(authCookie);
	if (authData) {
		pbServer.pb.authStore.save(authData.token, authData.model);
	}

	// Handle user update
	const userMatch = /^users\/([^/]+)$/.exec(endpoint);
	if (userMatch) {
		const userId = userMatch[1];

		return apiTryCatch(
			async () => {
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

				return {
					success: true,
					user: sanitizeUserData(updatedUser)
				};
			},
			'Failed to update user',
			400
		);
	}

	console.log('No matching route for PATCH', url.pathname);
	return json({ success: false, error: 'Invalid endpoint' }, { status: 404 });
};
