import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { ensureAuthenticated } from '$lib/pocketbase';

// GET: Fetch a specific folder by ID
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;

		if (!id) {
			return json({ success: false, error: 'Note ID is required' }, { status: 400 });
		}

		// Fetch note with expanded relations
		const note = await pb.collection('notes').getOne(id, {
			expand: 'createdBy,attachments'
		});

		// Verify ownership
		if (note.createdBy !== locals.user.id) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		return json({ success: true, note });
	} catch (error: unknown) {
		console.error('Error fetching note:', error);
		if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
			return json({ success: false, error: 'Note not found' }, { status: 404 });
		}
		return json({ success: false, error: 'Failed to fetch note' }, { status: 500 });
	}
};

// PATCH: Update folder details
export const PATCH: RequestHandler = async ({ params, request }) => {
	// Check if user is authenticated
	const isAuthenticated = await ensureAuthenticated();
	if (!isAuthenticated || !pb.authStore.model) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		if (!id) {
			return json({ error: 'Folder ID is required' }, { status: 400 });
		}
		const data = await request.json();
		const userId = pb.authStore.model.id;

		// Fetch folder
		const folder = await pb.collection('code_folders').getOne(id);

		// Check if user has write access to the repository
		const repository = await pb.collection('repositories').getOne(folder.repository);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Check if name is changing and if new name already exists in the same path
		if (data.name && data.name !== folder.name) {
			const existingFolders = await pb.collection('code_folders').getList(1, 1, {
				filter: `repository="${folder.repository}" && branch="${folder.branch}" && path="${folder.path}" && name="${data.name}" && id!="${id}"`
			});

			if (existingFolders.totalItems > 0) {
				return json(
					{ error: 'A folder with this name already exists in this location' },
					{ status: 400 }
				);
			}
		}

		// Update folder
		const updatedFolder = await pb.collection('code_folders').update(id, {
			name: data.name || folder.name,
			path: data.path || folder.path,
			parent: data.parent || folder.parent
		});

		return json(updatedFolder);
	} catch (error) {
		console.error('Error updating folder:', error);
		return json({ error: 'Failed to update folder' }, { status: 500 });
	}
};

// DELETE: Delete a folder
export const DELETE: RequestHandler = async ({ params }) => {
	// Check if user is authenticated
	const isAuthenticated = await ensureAuthenticated();
	if (!isAuthenticated || !pb.authStore.model) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		if (!id) {
			return json({ error: 'Folder ID is required' }, { status: 400 });
		}
		const userId = pb.authStore.model.id;
		// Fetch folder
		const folder = await pb.collection('code_folders').getOne(id);

		// Check if user has write access to the repository
		const repository = await pb.collection('repositories').getOne(folder.repository);
		const isOwner = repository.createdBy === userId;
		const isCollaborator = repository.repoCollaborators?.includes(userId);

		if (!isOwner && !isCollaborator) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Check if folder has child folders or files
		const childFolders = await pb.collection('code_folders').getList(1, 1, {
			filter: `parent="${id}"`
		});

		const childFiles = await pb.collection('code_files').getList(1, 1, {
			filter: `path~"${folder.path}${folder.name}/"`
		});

		if (childFolders.totalItems > 0 || childFiles.totalItems > 0) {
			return json(
				{ error: 'Cannot delete folder with contents. Delete contents first.' },
				{ status: 400 }
			);
		}

		// Delete folder
		await pb.collection('code_folders').delete(id);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting folder:', error);
		return json({ error: 'Failed to delete folder' }, { status: 500 });
	}
};
