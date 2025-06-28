import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

// GET: Fetch a specific repository by ID
export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const { id } = params;

		const result = await pbTryCatch(
			pb.collection('repositories').getOne(id, { expand: 'createdBy,project' }),
			'fetch repository'
		);

		const repository = unwrap(result);

		const isOwner = repository.createdBy === locals.user.id;
		const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new Error('Access denied');
		}

		return repository;
	}, 'Failed to fetch repository');

// PATCH: Update repository details
export const PATCH: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const { id } = params;
		const data = await request.json();

		const repositoryResult = await pbTryCatch(
			pb.collection('repositories').getOne(id),
			'fetch repository'
		);
		const repository = unwrap(repositoryResult);

		const isOwner = repository.createdBy === locals.user.id;
		const isCollaborator = repository.repoCollaborators?.includes(locals.user.id);

		if (!isOwner && !isCollaborator) {
			throw new Error('Access denied');
		}

		const updatedData = {
			repoName: data.repoName || repository.repoName,
			repoDescription:
				data.repoDescription !== undefined ? data.repoDescription : repository.repoDescription,
			repoCollaborators: data.repoCollaborators || repository.repoCollaborators,
			defaultBranch: data.defaultBranch || repository.defaultBranch,
			isPublic: data.isPublic !== undefined ? data.isPublic : repository.isPublic
		};

		const updateResult = await pbTryCatch(
			pb.collection('repositories').update(id, updatedData),
			'update repository'
		);
		const updatedRepository = unwrap(updateResult);

		return updatedRepository;
	}, 'Failed to update repository');

// DELETE: Delete a repository
export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const { id } = params;

		const repositoryResult = await pbTryCatch(
			pb.collection('repositories').getOne(id),
			'fetch repository'
		);
		const repository = unwrap(repositoryResult);

		if (repository.createdBy !== locals.user.id) {
			throw new Error('Only the repository owner can delete it');
		}

		const foldersResult = await pbTryCatch(
			pb.collection('code_folders').getList(1, 1000, { filter: `repository="${id}"` }),
			'fetch folders'
		);
		const folders = unwrap(foldersResult);
		for (const folder of folders.items) {
			await pbTryCatch(pb.collection('code_folders').delete(folder.id), 'delete folder');
		}

		const filesResult = await pbTryCatch(
			pb.collection('code_files').getList(1, 1000, { filter: `repository="${id}"` }),
			'fetch files'
		);
		const files = unwrap(filesResult);
		for (const file of files.items) {
			await pbTryCatch(pb.collection('code_files').delete(file.id), 'delete file');
		}

		const commitsResult = await pbTryCatch(
			pb.collection('code_commits').getList(1, 1000, { filter: `repository="${id}"` }),
			'fetch commits'
		);
		const commits = unwrap(commitsResult);
		for (const commit of commits.items) {
			await pbTryCatch(pb.collection('code_commits').delete(commit.id), 'delete commit');
		}

		await pbTryCatch(pb.collection('repositories').delete(id), 'delete repository');

		return { success: true };
	}, 'Failed to delete repository');
