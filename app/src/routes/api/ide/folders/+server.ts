// src/routes/api/ide/folders/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const repositoryId = url.searchParams.get('repository');
			const branch = url.searchParams.get('branch');

			if (!repositoryId || !branch) {
				throw new Error('Repository ID and branch are required');
			}

			// Verify repository access
			const repository = await pb.collection('repositories').getOne(repositoryId);
			const isOwner = repository.createdBy === locals.user.id;
			const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
			const isPublic = repository.isPublic;

			if (!isOwner && !isCollaborator && !isPublic) {
				throw new Error('Access denied');
			}

			// Fetch folders
			const folders = await pb.collection('code_folders').getList(1, 100, {
				filter: `repository="${repositoryId}" && branch="${branch}"`,
				sort: 'path,name'
			});

			return folders;
		},
		'Failed to fetch folders',
		500
	);

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const data = await request.json();

			// Validate required fields
			if (!data.name || !data.repository || !data.branch) {
				throw new Error('Name, repository, and branch are required');
			}

			// Verify repository access
			const repository = await pb.collection('repositories').getOne(data.repository);
			const isOwner = repository.createdBy === locals.user.id;
			const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);

			if (!isOwner && !isCollaborator) {
				throw new Error('Access denied');
			}

			// Create folder
			const folder = await pb.collection('code_folders').create({
				name: data.name,
				path: data.path || '/',
				repository: data.repository,
				branch: data.branch,
				parent: data.parent || null,
				createdBy: locals.user.id
			});

			return folder;
		},
		'Failed to create folder',
		500
	);
