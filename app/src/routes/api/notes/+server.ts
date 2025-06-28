// src/routes/api/notes/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from '@sveltejs/kit';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import type { RecordModel } from 'pocketbase';

export const GET: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const userId = locals.user.id;

		const folderId = url.searchParams.get('folderId');
		if (folderId === null) {
			throw new Error('Folder ID parameter is required');
		}

		const filter =
			folderId === ''
				? `createdBy="${userId}" && folder=""`
				: `createdBy="${userId}" && folder="${folderId}"`;

		const notes = await pbTryCatch(
			pb.collection('notes').getFullList({
				filter,
				sort: '-created',
				expand: 'createdBy,attachments'
			})
		);

		return json({ success: true, notes: unwrap(notes) as RecordModel[] });
	});

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const userId = locals.user.id;

		const data = await request.json();

		if (!data.title) {
			throw new Error('Title is required');
		}

		if (data.folder) {
			const folder = await pbTryCatch(pb.collection('notes_folders').getOne(data.folder));
			const folderData = unwrap(folder) as RecordModel;
			if (folderData.createdBy !== userId) {
				throw new Error('Access denied to folder');
			}
		}

		const note = await pbTryCatch(
			pb.collection('notes').create({
				title: data.title,
				content: data.content || '',
				folder: data.folder || '',
				order: data.order || 0,
				createdBy: userId
			})
		);

		const createdNote = await pbTryCatch(
			pb.collection('notes').getOne(unwrap(note).id, {
				expand: 'createdBy,attachments'
			})
		);

		return json({ success: true, note: unwrap(createdNote) as RecordModel });
	});

export const PUT: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const userId = locals.user.id;

		const data = await request.json();
		const { id, ...updateData } = data;

		if (!id) {
			throw new Error('Note ID is required');
		}

		const existingNote = await pbTryCatch(pb.collection('notes').getOne(id));
		const existingNoteData = unwrap(existingNote) as RecordModel;
		if (existingNoteData.createdBy !== userId) {
			throw new Error('Access denied');
		}

		if (updateData.folder && updateData.folder !== existingNoteData.folder) {
			const folder = await pbTryCatch(pb.collection('notes_folders').getOne(updateData.folder));
			const folderData = unwrap(folder) as RecordModel;
			if (folderData.createdBy !== userId) {
				throw new Error('Access denied to folder');
			}
		}

		const note = await pbTryCatch(pb.collection('notes').update(id, updateData));

		const updatedNote = await pbTryCatch(
			pb.collection('notes').getOne(unwrap(note).id, {
				expand: 'createdBy,attachments'
			})
		);

		return json({ success: true, note: unwrap(updatedNote) as RecordModel });
	});

export const DELETE: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}
		const userId = locals.user.id;

		const id = url.searchParams.get('id');
		if (!id) {
			throw new Error('Note ID is required');
		}

		const note = await pbTryCatch(pb.collection('notes').getOne(id));
		const noteData = unwrap(note) as RecordModel;
		if (noteData.createdBy !== userId) {
			throw new Error('Access denied');
		}

		const attachments = await pbTryCatch(
			pb.collection('attachments').getFullList({
				filter: `note="${id}"`
			})
		);

		for (const attachment of unwrap(attachments) as RecordModel[]) {
			await pbTryCatch(pb.collection('attachments').delete(attachment.id));
		}

		await pbTryCatch(pb.collection('notes').delete(id));

		return json({ success: true });
	});
