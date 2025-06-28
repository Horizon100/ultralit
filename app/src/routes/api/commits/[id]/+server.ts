import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(
		async () => {
			const isAuthenticated = await ensureAuthenticated();
			if (!isAuthenticated || !pb.authStore.model) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			const userId = pb.authStore.model.id;

			const commit = await pb.collection('code_commits').getOne(id, {
				expand: 'author,repository'
			});

			const repository =
				commit.expand?.repository ||
				(await pb.collection('repositories').getOne(commit.repository));
			const isOwner = repository.createdBy === userId;
			const isCollaborator = repository.repoCollaborators?.includes(userId);
			const isPublic = repository.isPublic;

			if (!isOwner && !isCollaborator && !isPublic) {
				throw new Error('Access denied');
			}

			return commit;
		},
		'Failed to fetch commit',
		500
	);
