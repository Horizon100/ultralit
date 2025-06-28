import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) => {
	return apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const searchTerm = url.searchParams.get('q');

			if (!searchTerm) {
				throw new Error('Search term is required');
			}

			const notes = await pb.collection('notes').getFullList({
				filter: `createdBy="${locals.user.id}" && (title ~ "${searchTerm}" || content ~ "${searchTerm}")`,
				sort: '-created',
				expand: 'createdBy,attachments'
			});

			return { notes };
		},
		'Failed to search notes',
		500
	);
};
