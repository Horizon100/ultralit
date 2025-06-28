import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

// GET: Fetch a specific folder by ID
export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			if (!id) {
				throw new Error('Folder ID is required');
			}

			const folder = await pb.collection('code_folders').getOne(id, {
				expand: 'createdBy,attachments' // adjust if needed
			});

			if (folder.createdBy !== locals.user.id) {
				throw new Error('Access denied');
			}

			return folder;
		},
		'Failed to fetch folder',
		500
	);

// PATCH: Update folder details
export const PATCH: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			if (!id) {
				throw new Error('Folder ID is required');
			}

			const data = await request.json();
			const userId = locals.user.id;

			const folder = await pb.collection('code_folders').getOne(id);
			const repository = await pb.collection('repositories').getOne(folder.repository);
			const isOwner = repository.createdBy === userId;
			const isCollaborator = repository.repoCollaborators?.includes(userId);

			if (!isOwner && !isCollaborator) {
				throw new Error('Access denied');
			}

			if (data.name && data.name !== folder.name) {
				const existingFolders = await pb.collection('code_folders').getList(1, 1, {
					filter: `repository="${folder.repository}" && branch="${folder.branch}" && path="${folder.path}" && name="${data.name}" && id!="${id}"`
				});
				if (existingFolders.totalItems > 0) {
					throw new Error('A folder with this name already exists in this location');
				}
			}

			const updatedFolder = await pb.collection('code_folders').update(id, {
				name: data.name || folder.name,
				path: data.path || folder.path,
				parent: data.parent || folder.parent
			});

			return updatedFolder;
		},
		'Failed to update folder',
		500
	);

// DELETE: Delete a folder
export const DELETE: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const { id } = params;
			if (!id) {
				throw new Error('Folder ID is required');
			}

			const userId = locals.user.id;
			const folder = await pb.collection('code_folders').getOne(id);
			const repository = await pb.collection('repositories').getOne(folder.repository);
			const isOwner = repository.createdBy === userId;
			const isCollaborator = repository.repoCollaborators?.includes(userId);

			if (!isOwner && !isCollaborator) {
				throw new Error('Access denied');
			}

			const childFolders = await pb.collection('code_folders').getList(1, 1, {
				filter: `parent="${id}"`
			});

			const childFiles = await pb.collection('code_files').getList(1, 1, {
				filter: `path~"${folder.path}${folder.name}/"`
			});

			if (childFolders.totalItems > 0 || childFiles.totalItems > 0) {
				throw new Error('Cannot delete folder with contents. Delete contents first.');
			}

			await pb.collection('code_folders').delete(id);

			return { success: true };
		},
		'Failed to delete folder',
		500
	);
