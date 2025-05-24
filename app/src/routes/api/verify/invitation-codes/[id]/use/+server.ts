import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { userId } = await request.json();
		const { id } = params;

		if (!id) {
			return json(
				{
					success: false,
					message: 'No invitation code ID provided'
				},
				{ status: 400 }
			);
		}

		if (!userId) {
			return json(
				{
					success: false,
					message: 'No user ID provided'
				},
				{ status: 400 }
			);
		}

		try {
			const invitationCode = await pb.collection('invitation_codes').getOne(id);

			if (invitationCode.used) {
				return json(
					{
						success: false,
						message: 'Invitation code has already been used'
					},
					{ status: 400 }
				);
			}

			console.log(`Updating invitation code ${id} for user ${userId}`);

			const updateData = {
				used: true,
				usedBy: userId,
				usedAt: new Date().toISOString()
			};

			console.log('Update data:', JSON.stringify(updateData));

			const result = await pb.collection('invitation_codes').update(id, updateData);

			console.log('Update result:', JSON.stringify(result));

			return json({
				success: true,
				message: 'Invitation code marked as used',
				result: result
			});
		} catch (error: unknown) {
			console.error('Error marking invitation code as used:', error);

			let message = 'Failed to mark invitation code as used';
			const status = 500;

			if (error instanceof Error) {
				message += ': ' + error.message;
			}

			// Type checking for PocketBase error response
			if (typeof error === 'object' && error !== null && 'response' in error) {
				console.error(
					'Response data:',
					(error as { response?: { data?: unknown } }).response?.data
				);
			}
			return json(
				{
					success: false,
					message
				},
				{ status }
			);
		}
	} catch (error: unknown) {
		console.error('Server error marking invitation code as used:', error);

		let message = 'Server error processing invitation code';
		if (error instanceof Error) {
			message += ': ' + error.message;
		}

		return json(
			{
				success: false,
				message
			},
			{ status: 500 }
		);
	}
};
