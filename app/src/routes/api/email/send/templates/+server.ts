// GET /api/email/send/templates - Get email templates
import { json } from '@sveltejs/kit';
import type { EmailApiResponse } from '$lib/types/types.email';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const category = url.searchParams.get('category') || 'all';

		if (!userId) {
			return json(
				{
					success: false,
					error: 'User ID is required'
				} satisfies EmailApiResponse,
				{ status: 400 }
			);
		}

		// Get email templates from database
		let filter = `userId = "${userId}"`;
		if (category !== 'all') {
			filter += ` && category = "${category}"`;
		}

		const templates = await pb.collection('email_templates').getFullList({
			filter,
			sort: '-created'
		});

		return json({
			success: true,
			data: templates
		} satisfies EmailApiResponse);
	} catch (error) {
		console.error('Failed to fetch email templates:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch email templates'
			} satisfies EmailApiResponse,
			{ status: 500 }
		);
	}
};
