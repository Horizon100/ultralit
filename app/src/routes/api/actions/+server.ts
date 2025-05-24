// src/routes/api/actions/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Actions } from '$lib/types/types';

export const GET: RequestHandler = async ({ locals }) => {
	console.log('=== Actions API GET started ===');
	
	try {
		console.log('Locals user:', locals.user);
		
		const user = locals.user;
		
		if (!user) {
			console.log('No user in locals');
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		console.log('User ID:', user.id);

		// Fetch actions created by the authenticated user
		console.log('Querying PocketBase for actions...');
		
		try {
			const records = await pb.collection('actions').getList(1, 50, {
				filter: `createdBy = "${user.id}"`,
				sort: '-created',
				expand: 'createdBy' 

			});

			console.log('PocketBase query successful, records:', records.items.length);

			const actions: Actions[] = records.items.map((record) => ({
				id: record.id,
				name: record.name,
				description: record.description,
				code: record.code,
				created: record.created,
				updated: record.updated,
				createdBy: record.expand?.createdBy || user
			}));

			console.log('Returning actions:', actions.length);
			return json({ success: true, actions });
			
		} catch (pbError) {
			console.error('PocketBase error:', pbError);
			return json({ 
				success: false, 
				error: 'Database query failed: ' + (pbError as Error).message 
			}, { status: 500 });
		}

	} catch (error) {
		console.error('=== Actions API error ===', error);
		return json({ 
			success: false, 
			error: 'Server error: ' + (error as Error).message 
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		
		// Create new action in PocketBase
		const record = await pb.collection('actions').create({
			name: body.name,
			description: body.description,
			code: body.code,
			createdBy: user.id
		});

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
	} catch (error) {
		console.error('Error creating action:', error);
		return json({ 
			success: false, 
			error: 'Failed to create action' 
		}, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const { id, ...updateData } = body;
		
		if (!id) {
			return json({ success: false, error: 'Action ID is required' }, { status: 400 });
		}

		// Verify the user owns this action before updating
		const existingRecord = await pb.collection('actions').getOne(id);
		if (existingRecord.createdBy !== user.id) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		// Update action in PocketBase
		const record = await pb.collection('actions').update(id, updateData, {
			expand: 'createdBy' 
		});
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
	} catch (error) {
		console.error('Error updating action:', error);
		return json({ 
			success: false, 
			error: 'Failed to update action' 
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	try {
		const user = locals.user;
		
		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		
		if (!id) {
			return json({ success: false, error: 'Action ID is required' }, { status: 400 });
		}

		// Verify the user owns this action before deleting
		const existingRecord = await pb.collection('actions').getOne(id);
		if (existingRecord.createdBy !== user.id) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		// Delete action from PocketBase
		await pb.collection('actions').delete(id);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting action:', error);
		return json({ 
			success: false, 
			error: 'Failed to delete action' 
		}, { status: 500 });
	}
};