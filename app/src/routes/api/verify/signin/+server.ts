import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';

// Helper function to sanitize user data for client
function sanitizeUserData(user: User | null): Partial<User> | null {
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

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json(
				{
					success: false,
					error: 'Email and password are required'
				},
				{ status: 400 }
			);
		}

		const authData = await pbServer.signIn(email, password);
		if (!authData) {
			return json({ success: false, error: 'Authentication failed' }, { status: 401 });
		}

		// Save auth to cookies
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
};
