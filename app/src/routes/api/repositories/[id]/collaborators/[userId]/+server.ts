import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const { id, userId } = params;

		const repositoryResult = await pbTryCatch(
			pb.collection('repositories').getOne(id),
			'fetch repository'
		);
		const repository = unwrap(repositoryResult);

		const isSelfRemoval = userId === locals.user.id;
		const isOwner = repository.createdBy === locals.user.id;

		if (!isOwner && !isSelfRemoval) {
			throw new Error('Only the repository owner can remove collaborators');
		}

		if (userId === repository.createdBy) {
			throw new Error('Cannot remove the repository owner');
		}

		let collaborators = repository.repoCollaborators || [];
		collaborators = collaborators.filter((collaboratorId: string) => collaboratorId !== userId);

		const updateResult = await pbTryCatch(
			pb.collection('repositories').update(id, { repoCollaborators: collaborators }),
			'update repository collaborators'
		);
		const updatedRepository = unwrap(updateResult);

		return json(updatedRepository);
	}, 'Failed to remove collaborator');
