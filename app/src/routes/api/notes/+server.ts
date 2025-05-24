// src/routes/api/notes/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const folderId = url.searchParams.get('folderId');

		if (folderId === null) {
			return json({ success: false, error: 'Folder ID parameter is required' }, { status: 400 });
		}

		const filter =
			folderId === ''
				? `createdBy="${locals.user.id}" && folder=""`
				: `createdBy="${locals.user.id}" && folder="${folderId}"`;

		// Fetch notes for the folder
		const notes = await pb.collection('notes').getFullList({
			filter,
			sort: '-created',
			expand: 'createdBy,attachments'
		});

		return json({ success: true, notes });
	} catch (error) {
		console.error('Error fetching notes:', error);
		return json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();

		// Validate required fields
		if (!data.title) {
			return json({ success: false, error: 'Title is required' }, { status: 400 });
		}

		// If folder is provided, verify ownership
		if (data.folder) {
			try {
				const folder = await pb.collection('notes_folders').getOne(data.folder);
				if (folder.createdBy !== locals.user.id) {
					return json({ success: false, error: 'Access denied to folder' }, { status: 403 });
				}
			} catch {
				return json({ success: false, error: 'Invalid folder' }, { status: 400 });
			}
		}

		// Create note
		const note = await pb.collection('notes').create({
			title: data.title,
			content: data.content || '',
			folder: data.folder || '',
			order: data.order || 0,
			createdBy: locals.user.id
		});

		// Fetch the created note with expanded relations
		const createdNote = await pb.collection('notes').getOne(note.id, {
			expand: 'createdBy,attachments'
		});

		return json({ success: true, note: createdNote });
	} catch (error) {
		console.error('Error creating note:', error);
		return json({ success: false, error: 'Failed to create note' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const data = await request.json();
		const { id, ...updateData } = data;

		if (!id) {
			return json({ success: false, error: 'Note ID is required' }, { status: 400 });
		}

		// Verify ownership
		const existingNote = await pb.collection('notes').getOne(id);
		if (existingNote.createdBy !== locals.user.id) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		// If folder is being changed, verify ownership of new folder
		if (updateData.folder && updateData.folder !== existingNote.folder) {
			try {
				const folder = await pb.collection('notes_folders').getOne(updateData.folder);
				if (folder.createdBy !== locals.user.id) {
					return json({ success: false, error: 'Access denied to folder' }, { status: 403 });
				}
			} catch {
				return json({ success: false, error: 'Invalid folder' }, { status: 400 });
			}
		}

		// Update note
		const note = await pb.collection('notes').update(id, updateData);

		// Fetch the updated note with expanded relations
		const updatedNote = await pb.collection('notes').getOne(note.id, {
			expand: 'createdBy,attachments'
		});

		return json({ success: true, note: updatedNote });
	} catch (error) {
		console.error('Error updating note:', error);
		return json({ success: false, error: 'Failed to update note' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const id = url.searchParams.get('id');

		if (!id) {
			return json({ success: false, error: 'Note ID is required' }, { status: 400 });
		}

		// Verify ownership
		const note = await pb.collection('notes').getOne(id);
		if (note.createdBy !== locals.user.id) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		// Delete associated attachments first
		try {
			const attachments = await pb.collection('attachments').getFullList({
				filter: `note="${id}"`
			});

			for (const attachment of attachments) {
				await pb.collection('attachments').delete(attachment.id);
			}
		} catch (error) {
			console.error('Error deleting attachments:', error);
			// Continue with note deletion even if attachment deletion fails
		}

		// Delete note
		await pb.collection('notes').delete(id);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting note:', error);
		return json({ success: false, error: 'Failed to delete note' }, { status: 500 });
	}
};
