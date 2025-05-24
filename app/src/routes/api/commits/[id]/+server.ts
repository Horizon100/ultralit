import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';

// GET: Fetch a specific commit by ID
export const GET: RequestHandler = async ({ params }) => {
	// Check if user is authenticated
	const isAuthenticated = await ensureAuthenticated();
	if (!isAuthenticated || !pb.authStore.model) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const userId = pb.authStore.model.id;

		// Fetch commit
		const commit = await pb.collection('code_commits').getOne(id, {
			expand: 'author,repository'
		});

		// Check if user has access to the repository
		const repository =
			commit.expand?.repository || (await pb.collection('repositories').getOne(commit.repository));
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		return json(commit);
	} catch (error) {
		console.error('Error fetching commit:', error);
		return json({ error: 'Failed to fetch commit' }, { status: 500 });
	}
};

/*
 * No PATCH/PUT for commits as they should be immutable
 * DELETE is uncommon for commits but could be implemented if needed for special cases
 */
