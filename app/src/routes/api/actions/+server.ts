import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Actions } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ locals }) =>
	apiTryCatch(async () => {
		const user = locals.user;
		if (!user) throw new Error('Authentication required');

		const recordsResult = await pbTryCatch(
			pb.collection('actions').getList(1, 50, {
				filter: `createdBy = "${user.id}"`,
				sort: '-created',
				expand: 'createdBy'
			}),
			'fetch actions'
		);
		const records = unwrap(recordsResult);

		const actions: Actions[] = records.items.map((record) => ({
			id: record.id,
			name: record.name,
			description: record.description,
			code: record.code,
			created: record.created,
			updated: record.updated,
			createdBy: record.expand?.createdBy || user
		}));

		return json({ success: true, actions });
	}, 'Failed to fetch actions');

export const POST: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		const user = locals.user;
		if (!user) throw new Error('Authentication required');

		const body = await request.json();

		const recordResult = await pbTryCatch(
			pb.collection('actions').create({
				name: body.name,
				description: body.description,
				code: body.code,
				createdBy: user.id
			}),
			'create action'
		);
		const record = unwrap(recordResult);

		const action: Actions = {
			id: record.id,
			name: record.name,
			description: record.description,
			code: record.code,
			created: record.created,
			updated: record.updated,
			createdBy: record.expand?.createdBy || user
		};

		return json({ success: true, action });
	}, 'Failed to create action');

export const PUT: RequestHandler = async ({ request, locals }) =>
	apiTryCatch(async () => {
		const user = locals.user;
		if (!user) throw new Error('Authentication required');

		const body = await request.json();
		const { id, ...updateData } = body;

		if (!id) throw new Error('Action ID is required');

		const existingResult = await pbTryCatch(
			pb.collection('actions').getOne(id),
			'fetch existing action'
		);
		const existingRecord = unwrap(existingResult);

		if (existingRecord.createdBy !== user.id) throw new Error('Access denied');

		const updatedResult = await pbTryCatch(
			pb.collection('actions').update(id, updateData, { expand: 'createdBy' }),
			'update action'
		);
		const record = unwrap(updatedResult);

		const action: Actions = {
			id: record.id,
			name: record.name,
			description: record.description,
			code: record.code,
			created: record.created,
			updated: record.updated,
			createdBy: record.expand?.createdBy || user
		};

		return json({ success: true, action });
	}, 'Failed to update action');

export const DELETE: RequestHandler = async ({ url, locals }) =>
	apiTryCatch(async () => {
		const user = locals.user;
		if (!user) throw new Error('Authentication required');

		const id = url.searchParams.get('id');
		if (!id) throw new Error('Action ID is required');

		const existingResult = await pbTryCatch(
			pb.collection('actions').getOne(id),
			'fetch existing action'
		);
		const existingRecord = unwrap(existingResult);

		if (existingRecord.createdBy !== user.id) throw new Error('Access denied');

		await pbTryCatch(pb.collection('actions').delete(id), 'delete action');

		return json({ success: true });
	}, 'Failed to delete action');
