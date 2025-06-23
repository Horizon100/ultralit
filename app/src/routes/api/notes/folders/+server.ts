import type { RequestHandler } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const folders = await pb.collection('notes_folders').getFullList({
			filter: `createdBy="${locals.user.id}"`,
			sort: 'order,created'
		});

		return { folders };
	}, 'Failed to fetch folders', 500);

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const data = await request.json();

		if (!data.title) {
			throw new Error('Title is required');
		}

		const folder = await pb.collection('notes_folders').create({
			title: data.title,
			order: data.order || 0,
			parentId: data.parentId || null,
			createdBy: locals.user.id
		});

		return { folder };
	}, 'Failed to create folder', 500);

export const PUT: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const data = await request.json();
		const { id, ...updateData } = data;

		if (!id) {
			throw new Error('Folder ID is required');
		}

		const existingFolder = await pb.collection('notes_folders').getOne(id);
		if (existingFolder.createdBy !== locals.user.id) {
			throw new Error('Access denied');
		}

		const folder = await pb.collection('notes_folders').update(id, updateData);

		return { folder };
	}, 'Failed to update folder', 500);

export const DELETE: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const id = url.searchParams.get('id');

		if (!id) {
			throw new Error('Folder ID is required');
		}

		const folder = await pb.collection('notes_folders').getOne(id);
		if (folder.createdBy !== locals.user.id) {
			throw new Error('Access denied');
		}

		const childNotes = await pb.collection('notes').getList(1, 1, {
			filter: `folder="${id}"`
		});

		if (childNotes.totalItems > 0) {
			throw new Error('Cannot delete folder with notes. Move notes first.');
		}

		await pb.collection('notes_folders').delete(id);

		return {};
	}, 'Failed to delete folder', 500);