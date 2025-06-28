import PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import type { User } from '$lib/types/types';
import type { Cookies } from '@sveltejs/kit';
import { pbTryCatch } from '$lib/utils/errorUtils';

// Setup
export const pb = new PocketBase('http://172.104.188.44:80');
pb.autoCancellation(false);

// Utility variable for auth checks
let lastAuthCheck = 0;
const AUTH_CHECK_COOLDOWN = 5000;

// ============= Authentication Functions =============

export async function checkPocketBaseConnection() {
	const result = await pbTryCatch(pb.health.check(), 'PocketBase health check');
	if (result.success) {
		console.log('PocketBase health check:', result.data);
		return true;
	} else {
		console.error('PocketBase connection error:', result.error);
		return false;
	}
}

export async function ensureAuthenticated(cookies?: Cookies): Promise<boolean> {
	console.log('Checking authentication...');
	const now = Date.now();

	// Restore from cookie if available
	if (cookies) {
		const authCookie = cookies.get('pb_auth');
		if (authCookie) {
			try {
				const authData = JSON.parse(authCookie);
				pb.authStore.save(authData.token, authData.model);
				console.log('Restored auth from cookie');
			} catch (e) {
				console.error('Error parsing auth cookie:', e);
			}
		}
	}

	console.log('Current auth model:', pb.authStore.model ? 'exists' : 'null');
	console.log('Is auth valid?', pb.authStore.isValid);

	if (pb.authStore.isValid && now - lastAuthCheck < AUTH_CHECK_COOLDOWN) {
		console.log('Auth is valid and checked recently, returning true');
		return true;
	}

	lastAuthCheck = now;

	if (!pb.authStore.token) {
		console.log('No token available, authentication fails');
		return false;
	}

	const refreshResult = await pbTryCatch(
		pb.collection('users').authRefresh(),
		'refresh auth token'
	);
	if (refreshResult.success) {
		console.log('Auth token refreshed successfully');
		return pb.authStore.isValid;
	} else {
		if (refreshResult.error?.includes('401')) {
			console.log('Token refresh failed: Token invalid or expired');
			pb.authStore.clear();
			return false;
		}
		console.error('Error during token refresh:', refreshResult.error);
		return pb.authStore.isValid;
	}
}

export async function signUp(email: string, password: string): Promise<User | null> {
	const result = await pbTryCatch(
		pb.collection('users').create<User>({
			email,
			password,
			passwordConfirm: password
		}),
		'sign-up'
	);
	if (result.success) {
		return result.data;
	} else {
		console.error('Sign-up error:', result.error);
		return null;
	}
}

export async function signIn(email: string, password: string): Promise<User | null> {
	const result = await pbTryCatch(
		pb.collection('users').authWithPassword<User>(email, password),
		'sign-in'
	);
	if (result.success) {
		return result.data.record;
	} else {
		console.error('Sign-in error:', result.error);
		return null;
	}
}

export function signOut() {
	pb.authStore.clear();
}

export async function updateUser(id: string, userData: FormData | Partial<User>): Promise<User> {
	const currentUserId = pb.authStore.model?.id;

	if (!currentUserId || id !== currentUserId) {
		throw new Error('Unauthorized: You can only update your own profile');
	}

	const result = await pbTryCatch(pb.collection('users').update(id, userData), 'update user');
	if (result.success) {
		return result.data as User;
	} else {
		console.error('Update user error:', result.error);
		throw new Error(result.error);
	}
}

export async function getUserById(id: string): Promise<User | null> {
	const currentUserId = pb.authStore.model?.id;
	if (!currentUserId) {
		console.error('Unauthorized: You must be logged in');
		return null;
	}

	const result = await pbTryCatch(pb.collection('users').getOne(id), 'get user by id');
	if (result.success) {
		const record = result.data;
		if (id === currentUserId) {
			return record as User;
		}

		const publicUser = {
			id: record.id,
			username: record.username,
			name: record.name,
			avatar: record.avatar,
			created: record.created,
			updated: record.updated
		};

		return publicUser as User;
	} else {
		console.error('Error fetching user:', result.error);
		return null;
	}
}

export async function getPublicUserData(userId: string): Promise<Partial<User> | null> {
	const result = await pbTryCatch(pb.collection('users').getOne(userId), 'get public user data');
	if (result.success) {
		const record = result.data;
		return {
			id: record.id,
			username: record.username,
			name: record.name,
			avatar: record.avatar
		};
	} else {
		console.error('Error fetching public user data:', result.error);
		return null;
	}
}

export async function authenticateWithGoogle() {
	const result = await pbTryCatch(
		pb.collection('users').authWithOAuth2({
			provider: 'google',
			createData: {}
		}),
		'google authentication'
	);
	if (result.success) {
		return result.data;
	} else {
		console.error('Google authentication error:', result.error);
		throw new Error(result.error);
	}
}

export async function requestPasswordReset(email: string): Promise<boolean> {
	const result = await pbTryCatch(
		pb.collection('users').requestPasswordReset(email),
		'password reset request'
	);
	if (result.success) {
		return true;
	} else {
		console.error('Server-side password reset error:', result.error);
		throw new Error(result.error);
	}
}
