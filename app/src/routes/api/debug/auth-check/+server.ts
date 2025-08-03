// src/routes/api/debug/auth-check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ locals, request }) => {
	console.log('🔍 Auth check GET request');

	const cookieHeader = request.headers.get('cookie') || '';
	const parsedCookies: Record<string, string> = {};

	if (cookieHeader) {
		try {
			// Parse cookies manually
			cookieHeader.split(';').forEach((cookie) => {
				const [name, value] = cookie.trim().split('=');
				if (name && value) {
					parsedCookies[name] = value;
				}
			});
		} catch (e) {
			console.error('Error parsing cookies:', e);
		}
	}

	return json({
		method: 'GET',
		timestamp: new Date().toISOString(),
		authentication: {
			hasLocalsUser: !!locals.user,
			localsUserId: locals.user?.id,
			localsUserEmail: locals.user?.email,
			localsUserUsername: locals.user?.username
		},
		cookies: {
			hasCookieHeader: !!cookieHeader,
			cookieHeader: cookieHeader.substring(0, 100) + (cookieHeader.length > 100 ? '...' : ''),
			parsedCookies: Object.keys(parsedCookies),
			hasPbAuth: 'pb_auth' in parsedCookies
		},
		pocketbase: {
			authStoreValid: pb.authStore.isValid,
			hasToken: !!pb.authStore.token,
			hasModel: !!pb.authStore.model,
			modelId: pb.authStore.model?.id || null,
			modelEmail: pb.authStore.model?.email || null
		}
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	console.log('🔍 Auth check POST request');

	const cookieHeader = request.headers.get('cookie') || '';
	const parsedCookies: Record<string, string> = {};

	if (cookieHeader) {
		try {
			// Parse cookies manually
			cookieHeader.split(';').forEach((cookie) => {
				const [name, value] = cookie.trim().split('=');
				if (name && value) {
					parsedCookies[name] = value;
				}
			});
		} catch (e) {
			console.error('Error parsing cookies:', e);
		}
	}

	return json({
		method: 'POST',
		timestamp: new Date().toISOString(),
		authentication: {
			hasLocalsUser: !!locals.user,
			localsUserId: locals.user?.id,
			localsUserEmail: locals.user?.email,
			localsUserUsername: locals.user?.username
		},
		cookies: {
			hasCookieHeader: !!cookieHeader,
			cookieHeader: cookieHeader.substring(0, 100) + (cookieHeader.length > 100 ? '...' : ''),
			parsedCookies: Object.keys(parsedCookies),
			hasPbAuth: 'pb_auth' in parsedCookies
		},
		pocketbase: {
			authStoreValid: pb.authStore.isValid,
			hasToken: !!pb.authStore.token,
			hasModel: !!pb.authStore.model,
			modelId: pb.authStore.model?.id || null,
			modelEmail: pb.authStore.model?.email || null
		}
	});
};
