import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

// GET: Get all collaborators for a repository
export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const { id } = params;

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === locals.user.id;
		const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new Error('Access denied');
		}

		const collaboratorIds = [repository.createdBy, ...(repository.repoCollaborators || [])];
		const uniqueIds = [...new Set(collaboratorIds)];

		const collaborators = [];
		for (const userId of uniqueIds) {
			try {
				const user = await pb.collection('users').getOne(userId, {
					fields: 'id,username,name,avatar'
				});
				collaborators.push({
					...user,
					isOwner: userId === repository.createdBy
				});
			} catch (err) {
				console.error(`Error fetching user ${userId}:`, err);
				// Skip this user if fetch fails
			}
		}

		return collaborators;
	}, 'Failed to fetch collaborators', 500);

// POST: Add a collaborator to the repository
export const POST: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const data = await request.json();

		if (!data.userId) {
			throw new Error('User ID is required');
		}

		const repository = await pb.collection('repositories').getOne(id);
		if (repository.createdBy !== locals.user.id) {
			throw new Error('Only the repository owner can add collaborators');
		}

		// Check if user exists
		try {
			await pb.collection('users').getOne(data.userId);
		} catch {
			throw new Error('User not found');
		}

		const collaborators = repository.repoCollaborators || [];
		if (!collaborators.includes(data.userId)) {
			collaborators.push(data.userId);

			const updatedRepository = await pb.collection('repositories').update(id, {
				repoCollaborators: collaborators
			});

			return updatedRepository;
		}

		return repository;
	}, 'Failed to add collaborator', 500);
