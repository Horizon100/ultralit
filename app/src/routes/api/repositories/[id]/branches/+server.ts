import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const userId = pb.authStore.model.id;

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new Error('Access denied');
		}

		const folderBranches = await pb.collection('code_folders').getList(1, 1000, {
			filter: `repository="${id}"`,
			fields: 'branch'
		});

		const fileBranches = await pb.collection('code_files').getList(1, 1000, {
			filter: `repository="${id}"`,
			fields: 'branch'
		});

		const folderBranchNames = folderBranches.items.map((item) => item.branch);
		const fileBranchNames = fileBranches.items.map((item) => item.branch);
		const allBranches = [...new Set([...folderBranchNames, ...fileBranchNames])];

		const branchesWithMetadata = await Promise.all(
			allBranches.map(async (branchName) => {
				const latestCommit = await pb.collection('code_commits').getList(1, 1, {
					filter: `repository="${id}" && branch="${branchName}"`,
					sort: '-created'
				});

				return {
					name: branchName,
					isDefault: branchName === repository.defaultBranch,
					latestCommit: latestCommit.items.length > 0 ? latestCommit.items[0] : null,
					protected: branchName === repository.defaultBranch
				};
			})
		);

		return json({ success: true, data: branchesWithMetadata });
	}, 'Failed to fetch branches');

export const POST: RequestHandler = async ({ params, request }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) {
			throw new Error('Unauthorized');
		}

		const { id } = params;
		const data = await request.json();
		const userId = pb.authStore.model.id;

		if (!data.name || !data.sourceBranch) {
			throw new Error('Branch name and source branch are required');
		}

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) {
			throw new Error('Access denied');
		}

		const existingFolders = await pb.collection('code_folders').getList(1, 1, {
			filter: `repository="${id}" && branch="${data.name}"`
		});

		if (existingFolders.totalItems > 0) {
			throw new Error('Branch already exists');
		}

		const sourceFolders = await pb.collection('code_folders').getList(1, 1000, {
			filter: `repository="${id}" && branch="${data.sourceBranch}"`
		});

		for (const folder of sourceFolders.items) {
			await pb.collection('code_folders').create({
				name: folder.name,
				path: folder.path,
				repository: id,
				branch: data.name,
				createdBy: userId,
				parent: folder.parent
			});
		}

		const sourceFiles = await pb.collection('code_files').getList(1, 1000, {
			filter: `repository="${id}" && branch="${data.sourceBranch}"`
		});

		for (const file of sourceFiles.items) {
			await pb.collection('code_files').create({
				name: file.name,
				content: file.content,
				path: file.path,
				repository: id,
				branch: data.name,
				createdBy: userId,
				lastEditedBy: userId,
				size: file.size,
				language: file.language
			});
		}

		await pb.collection('code_commits').create({
			message: `Created branch '${data.name}' from '${data.sourceBranch}'`,
			repository: id,
			branch: data.name,
			author: userId,
			changedFiles: [],
			hash: Date.now().toString(36).substring(2, 10)
		});

		return json({
			success: true,
			branch: {
				name: data.name,
				isDefault: false,
				protected: false
			}
		});
	}, 'Failed to create branch');
