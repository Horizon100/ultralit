import type { RequestHandler } from './$types';
import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

// GET: Fetch details about a specific branch
export const GET: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) {
			throw new Error('Unauthorized');
		}

		const { id, branch } = params;
		const userId = pb.authStore.model.id;

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);
		const isPublic = repository.isPublic;

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new Error('Forbidden');
		}

		const branchFolders = await pb.collection('code_folders').getList(1, 1, {
			filter: `repository="${id}" && branch="${branch}"`
		});

		if (branchFolders.totalItems === 0) {
			throw new Error('Branch not found');
		}

		const latestCommits = await pb.collection('code_commits').getList(1, 10, {
			filter: `repository="${id}" && branch="${branch}"`,
			sort: '-created',
			expand: 'author'
		});

		const folderCount = await pb.collection('code_folders').getList(1, 1, {
			filter: `repository="${id}" && branch="${branch}"`,
			countOnly: true
		});

		const fileCount = await pb.collection('code_files').getList(1, 1, {
			filter: `repository="${id}" && branch="${branch}"`,
			countOnly: true
		});

		return {
			name: branch,
			isDefault: branch === repository.defaultBranch,
			protected: branch === repository.defaultBranch,
			commits: latestCommits.items,
			stats: {
				folderCount: folderCount.totalItems,
				fileCount: fileCount.totalItems
			}
		};
	}, 'Failed to fetch branch details', 500);

// PATCH: Update branch (e.g., set as default)
export const PATCH: RequestHandler = async ({ params, request }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) {
			throw new Error('Unauthorized');
		}

		const { id, branch } = params;
		const data = await request.json();
		const userId = pb.authStore.model.id;

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === userId;

		if (!isOwner) {
			throw new Error('Forbidden');
		}

		const branchFolders = await pb.collection('code_folders').getList(1, 1, {
			filter: `repository="${id}" && branch="${branch}"`
		});

		if (branchFolders.totalItems === 0) {
			throw new Error('Branch not found');
		}

		if (data.setAsDefault) {
			await pb.collection('repositories').update(id, {
				defaultBranch: branch
			});
		}

		return {
			success: true,
			name: branch,
			isDefault: data.setAsDefault ? true : branch === repository.defaultBranch,
			protected: branch === repository.defaultBranch || data.setAsDefault
		};
	}, 'Failed to update branch', 500);

// DELETE: Delete a branch
export const DELETE: RequestHandler = async ({ params }) =>
	apiTryCatch(async () => {
		const isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated || !pb.authStore.model) {
			throw new Error('Unauthorized');
		}

		const { id, branch } = params;
		const userId = pb.authStore.model.id;

		const repository = await pb.collection('repositories').getOne(id);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) {
			throw new Error('Forbidden');
		}

		if (branch === repository.defaultBranch) {
			throw new Error('Cannot delete the default branch');
		}

		const folders = await pb.collection('code_folders').getList(1, 1000, {
			filter: `repository="${id}" && branch="${branch}"`
		});

		for (const folder of folders.items) {
			await pb.collection('code_folders').delete(folder.id);
		}

		const files = await pb.collection('code_files').getList(1, 1000, {
			filter: `repository="${id}" && branch="${branch}"`
		});

		for (const file of files.items) {
			await pb.collection('code_files').delete(file.id);
		}

		const commits = await pb.collection('code_commits').getList(1, 1000, {
			filter: `repository="${id}" && branch="${branch}"`
		});

		for (const commit of commits.items) {
			await pb.collection('code_commits').delete(commit.id);
		}

		return { success: true };
	}, 'Failed to delete branch', 500);