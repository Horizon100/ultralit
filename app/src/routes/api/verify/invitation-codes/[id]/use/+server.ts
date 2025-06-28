import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ params, request }) =>
	apiTryCatch(async () => {
		const { userId } = await request.json();
		const { id } = params;

		if (!id) {
			throw new Error('No invitation code ID provided');
		}

		if (!userId) {
			throw new Error('No user ID provided');
		}

		const invitationCode = await pb.collection('invitation_codes').getOne(id);

		if (invitationCode.used) {
			throw new Error('Invitation code has already been used');
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

		return {
			message: 'Invitation code marked as used',
			result
		};
	}, 'Failed to mark invitation code as used');
