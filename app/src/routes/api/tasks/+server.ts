import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import type { Task } from '$lib/types/types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Fixed filter - removed the problematic project_id="" condition
		const tasks = await pb.collection('tasks').getList(1, 100, {
			filter: `createdBy="${locals.user.id}" && status!="archive"`,
			sort: '-created',
			expand: 'createdBy,allocatedAgents,taskTags'
		});

		// Transform the data to match your KanbanTask interface expectations
		const transformedTasks = {
			...tasks,
			items: (tasks.items as Task[]).map((task: Task) => ({
				...task,
				// Map your existing fields to expected hierarchy fields
				owner: task.createdBy,
				assigned_to: task.allocatedAgents?.[0] || null,
				priority: task.priority || 'medium',
				project_id: task.project_id || null
			}))
		};

		return json(transformedTasks);
	} catch (err) {
		console.error('❌ Error fetching tasks:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tasks';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = await request.json();
		data.createdBy = locals.user.id;

		const task = await pb.collection('tasks').create(data);

		return json(task);
	} catch (err) {
		console.error('❌ Error creating task:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

// Add additional handlers if needed
export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = await request.json();

		if (!data.id) {
			return new Response(JSON.stringify({ error: 'Task ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Verify user has permission to update this task
		const existingTask = await pb.collection('tasks').getOne(data.id);
		if (existingTask.createdBy !== locals.user.id) {
			return new Response(JSON.stringify({ error: 'Not authorized to update this task' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Update task
		const updatedTask = await pb.collection('tasks').update(data.id, data);

		return json(updatedTask);
	} catch (err) {
		console.error('❌ Error updating task:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const taskId = url.searchParams.get('id');
		if (!taskId) {
			return new Response(JSON.stringify({ error: 'Task ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Verify user has permission to delete this task
		const existingTask = await pb.collection('tasks').getOne(taskId);
		if (existingTask.createdBy !== locals.user.id) {
			return new Response(JSON.stringify({ error: 'Not authorized to delete this task' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Delete task
		await pb.collection('tasks').delete(taskId);

		return json({ success: true });
	} catch (err) {
		console.error('❌ Error deleting task:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to delete task';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
