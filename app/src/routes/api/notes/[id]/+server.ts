import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const { id } = params;

	if (!id) {
		return new Response(JSON.stringify({ success: false, error: 'Note ID is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return apiTryCatch(async () => {
		const note = await pb.collection('notes').getOne(id, {
			expand: 'createdBy,attachments'
		});

		if (note.createdBy !== locals.user?.id) {
			const err = new Error('Access denied');
			err.name = 'Forbidden';
			throw err;
		}

		return { note };
	}, 'Failed to fetch note');
};
