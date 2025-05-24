import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { token, password, passwordConfirm } = await request.json();

		if (!token || !password || !passwordConfirm) {
			return json(
				{
					success: false,
					error: 'Token, password, and password confirmation are required'
				},
				{ status: 400 }
			);
		}

		if (password !== passwordConfirm) {
			return json(
				{
					success: false,
					error: 'Passwords do not match'
				},
				{ status: 400 }
			);
		}

		await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);

		return json({ success: true });
	} catch (error) {
		console.error('Password reset confirmation API error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'An error occurred during password reset'
			},
			{ status: 500 }
		);
	}
};
