// GET /api/email/send/templates - Get email templates
export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId');
		const category = url.searchParams.get('category') || 'all';

		if (!userId) {
			return json<EmailApiResponse>(
				{
					success: false,
					error: 'User ID is required'
				},
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

		return json<EmailApiResponse>({
			success: true,
			data: templates
		});
	} catch (error) {
		console.error('Failed to fetch email templates:', error);
		return json<EmailApiResponse>(
			{
				success: false,
				error: 'Failed to fetch email templates'
			},
			{ status: 500 }
		);
	}
};
