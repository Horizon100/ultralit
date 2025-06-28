import { pb, ensureAuthenticated } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';
import type { RequestHandler } from './$types';

// POST: Merge a source branch into a target branch
export const POST: RequestHandler = async ({ params, request }) =>
	apiTryCatch(
		async () => {
			// Authentication check
			const isAuthenticated = await ensureAuthenticated();
			if (!isAuthenticated || !pb.authStore.model) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			const data = await request.json();
			const userId = pb.authStore.model.id;

			// Validate required fields
			if (!data.sourceBranch || !data.targetBranch) {
				throw new Error('Source and target branches are required');
			}

			// Check user permissions
			const repository = await pb.collection('repositories').getOne(id);
			const isOwner = repository.createdBy === userId;
			const isCollaborator = repository.repoCollaborators?.includes(userId);

			if (!isOwner && !isCollaborator) {
				throw new Error('Access denied');
			}

			// Verify branches exist
			const sourceBranchFolders = await pb.collection('code_folders').getList(1, 1, {
				filter: `repository="${id}" && branch="${data.sourceBranch}"`
			});

			const targetBranchFolders = await pb.collection('code_folders').getList(1, 1, {
				filter: `repository="${id}" && branch="${data.targetBranch}"`
			});

			if (sourceBranchFolders.totalItems === 0) {
				throw new Error('Source branch not found');
			}

			if (targetBranchFolders.totalItems === 0) {
				throw new Error('Target branch not found');
			}

			// Fetch source and target files
			const sourceFiles = await pb.collection('code_files').getList(1, 1000, {
				filter: `repository="${id}" && branch="${data.sourceBranch}"`
			});

			const targetFiles = await pb.collection('code_files').getList(1, 1000, {
				filter: `repository="${id}" && branch="${data.targetBranch}"`
			});

			// Map target files by path+name
			const targetFileMap = new Map();
			targetFiles.items.forEach((file) => {
				const key = `${file.path}${file.name}`;
				targetFileMap.set(key, file);
			});

			const changedFiles: string[] = [];

			// Merge files: update existing or create new in target
			for (const sourceFile of sourceFiles.items) {
				const key = `${sourceFile.path}${sourceFile.name}`;

				if (targetFileMap.has(key)) {
					const targetFile = targetFileMap.get(key);

					const sourceContent = Array.isArray(sourceFile.content)
						? sourceFile.content.join('')
						: sourceFile.content;
					const targetContent = Array.isArray(targetFile.content)
						? targetFile.content.join('')
						: targetFile.content;

					if (sourceContent !== targetContent) {
						await pb.collection('code_files').update(targetFile.id, {
							content: sourceFile.content,
							lastEditedBy: userId,
							size: sourceFile.size
						});
						changedFiles.push(key);
					}
				} else {
					await pb.collection('code_files').create({
						name: sourceFile.name,
						content: sourceFile.content,
						path: sourceFile.path,
						repository: id,
						branch: data.targetBranch,
						createdBy: userId,
						lastEditedBy: userId,
						size: sourceFile.size,
						language: sourceFile.language
					});
					changedFiles.push(key);
				}
			}

			// Fetch and merge folders similarly
			const sourceFolders = await pb.collection('code_folders').getList(1, 1000, {
				filter: `repository="${id}" && branch="${data.sourceBranch}"`
			});

			const targetFolders = await pb.collection('code_folders').getList(1, 1000, {
				filter: `repository="${id}" && branch="${data.targetBranch}"`
			});

			const targetFolderMap = new Map();
			targetFolders.items.forEach((folder) => {
				const key = `${folder.path}${folder.name}`;
				targetFolderMap.set(key, folder);
			});

			for (const sourceFolder of sourceFolders.items) {
				const key = `${sourceFolder.path}${sourceFolder.name}`;
				if (!targetFolderMap.has(key)) {
					await pb.collection('code_folders').create({
						name: sourceFolder.name,
						path: sourceFolder.path,
						repository: id,
						branch: data.targetBranch,
						createdBy: userId,
						parent: sourceFolder.parent
					});
				}
			}

			// Create a merge commit if files changed
			if (changedFiles.length > 0) {
				const commitMessage =
					data.commitMessage || `Merged branch '${data.sourceBranch}' into '${data.targetBranch}'`;

				await pb.collection('code_commits').create({
					message: commitMessage,
					repository: id,
					branch: data.targetBranch,
					author: userId,
					changedFiles,
					hash: Date.now().toString(36).substring(2, 10) // simple hash
				});
			}

			return {
				success: true,
				changedFilesCount: changedFiles.length,
				changedFiles
			};
		},
		'Failed to merge branches',
		500
	);
