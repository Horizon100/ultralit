// src/routes/api/tasks/hierarchy/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import type { Task } from '$lib/types/types';

export const GET: RequestHandler = async ({ url, locals }) => {
	console.log('=== Hierarchy API Called ===');
	
	try {
		if (!locals.user) {
			console.log('No user in locals');
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		console.log('User ID:', locals.user.id);

		const projectId = url.searchParams.get('project_id');
		const type = url.searchParams.get('type') || 'status';
		
		console.log('Project ID:', projectId);
		console.log('Type:', type);

		// Simplified filter - let's start with just user's tasks
		let filter = `createdBy="${locals.user.id}"`;
		
		if (projectId && projectId !== 'null' && projectId !== 'undefined') {
			filter += ` && project_id="${projectId}"`;
		}
		
		// Don't include archived tasks
		filter += ` && status!="archive"`;
		
		console.log('Filter:', filter);

		const tasks = await pb.collection('tasks').getList(1, 500, {
			filter,
			sort: '-created'
		});

		console.log('Tasks found:', tasks.items.length);

		// If no tasks found, return empty structure
		if (tasks.items.length === 0) {
			return json({
				name: "No Tasks Found",
				children: []
			});
		}

		// Create detailed hierarchy with tasks as leaf nodes
        const statusGroups: { [key: string]: Task[] } = {};		
        const taskItems = tasks.items as Task[];
        taskItems.forEach(task => {
            const status = task.status || 'unknown';
            if (!statusGroups[status]) {
                statusGroups[status] = [];
            }
            statusGroups[status].push(task);
        });
		console.log('Status groups:', Object.keys(statusGroups));

		const children = Object.entries(statusGroups).map(([status, statusTasks]) => {
			// Group by priority within each status
            const priorityGroups: { [key: string]: Task[] } = {};			
			statusTasks.forEach(task => {
				const priority = task.priority || 'medium';
				if (!priorityGroups[priority]) {
					priorityGroups[priority] = [];
				}
				priorityGroups[priority].push(task);
			});

			// Create priority children with individual tasks as leaf nodes
			const priorityChildren = Object.entries(priorityGroups).map(([priority, priorityTasks]) => ({
				name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
				value: priorityTasks.length,
				children: priorityTasks.map(task => ({
					name: task.title,
					value: 1,
					taskId: task.id,
					taskData: {
						id: task.id,
						title: task.title,
						description: task.taskDescription || '',
						status: task.status,
						priority: task.priority || 'medium',
						createdBy: task.createdBy,
						assignedTo: task.assignedTo,
						due_date: task.due_date,
						start_date: task.start_date,
						project_id: task.project_id
					}
				}))
			}));

			return {
				name: status.charAt(0).toUpperCase() + status.slice(1),
				value: statusTasks.length,
				children: priorityChildren
			};
		});

		const hierarchyData = {
			name: "Task Status Distribution",
			children
		};

		console.log('Hierarchy data created with task details');

		return json(hierarchyData);
		
	} catch (err) {
		console.error('=== ERROR in hierarchy API ===');
		console.error('Error:', err);
		
		// Log more details about PocketBase errors
		if (err && typeof err === 'object' && 'data' in err) {
			console.error('PocketBase error data:', err.data);
		}
		
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch hierarchy data';
		return new Response(JSON.stringify({ 
			error: errorMessage,
			details: err instanceof Error ? err.stack : String(err)
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};