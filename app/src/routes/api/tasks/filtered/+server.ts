import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const projectId = url.searchParams.get('project_id');
		const status = url.searchParams.get('status');
		const priority = url.searchParams.get('priority');
		
		console.log('Filtering tasks:', { projectId, status, priority });

		// Build filter
		let filter = `createdBy="${locals.user.id}"`;
		
		if (projectId && projectId !== 'null' && projectId !== 'undefined') {
			filter += ` && project_id="${projectId}"`;
		}
		
		if (status && status !== 'all') {
			filter += ` && status="${status.toLowerCase()}"`;
		}
		
		if (priority && priority !== 'all') {
			filter += ` && priority="${priority.toLowerCase()}"`;
		}
		
		filter += ` && status!="archive"`;
		
		console.log('Filter:', filter);

		const tasks = await pb.collection('tasks').getList(1, 100, {
			filter,
			sort: '-created'
		});

		console.log('Filtered tasks found:', tasks.items.length);

		return json({
			tasks: tasks.items,
			count: tasks.items.length,
			filter: { projectId, status, priority }
		});

	} catch (err) {
		console.error('Error filtering tasks:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to filter tasks';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};