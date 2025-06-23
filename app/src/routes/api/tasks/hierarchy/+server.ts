// src/routes/api/tasks/hierarchy/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import type { Task } from '$lib/types/types';
import { apiTryCatch, pbTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ url, locals }) => {
	console.log('=== Hierarchy API Called ===');

	return await apiTryCatch(async () => {
		// Check authentication
		if (!locals.user) {
			console.log('No user in locals');
			throw new Error('Authentication required');
		}

		console.log('User ID:', locals.user.id);

		const projectId = url.searchParams.get('project_id');
		const type = url.searchParams.get('type') || 'status';

		console.log('Project ID:', projectId);
		console.log('Type:', type);

		// Build filter for user's tasks
		let filter = `createdBy="${locals.user.id}"`;

		if (projectId && projectId !== 'null' && projectId !== 'undefined') {
			filter += ` && project_id="${projectId}"`;
		}

		// Don't include archived tasks
		filter += ` && status!="archive"`;

		console.log('Filter:', filter);

		// Use pbTryCatch for PocketBase operations
		const tasksResult = await pbTryCatch(
			pb.collection('tasks').getList(1, 500, {
				filter,
				sort: '-created'
			}),
			'fetch tasks for hierarchy'
		);

		if (isFailure(tasksResult)) {
			console.error('Failed to fetch tasks:', tasksResult.error);
			throw new Error(tasksResult.error);
		}

		const tasks = tasksResult.data;
		console.log('Tasks found:', tasks.items.length);

		// If no tasks found, return empty structure
		if (tasks.items.length === 0) {
			console.log('No tasks found, returning empty hierarchy');
			return {
				name: 'No Tasks Found',
				children: []
			};
		}

		// Create detailed hierarchy with tasks as leaf nodes
		const statusGroups: { [key: string]: Task[] } = {};
		const taskItems = tasks.items as Task[];
		
		taskItems.forEach((task) => {
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
			statusTasks.forEach((task) => {
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
				children: priorityTasks.map((task) => ({
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
			name: 'Task Status Distribution',
			children
		};

		console.log('Hierarchy data created with task details');

		return hierarchyData;

	}, 'Failed to fetch hierarchy data', 500);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	return await apiTryCatch(async () => {
		if (!locals.user) {
			throw new Error('Authentication required');
		}

		const { type, projectId, filters } = await request.json();

		// Validate input
		if (!type) {
			throw new Error('Hierarchy type is required');
		}

		let filter = `createdBy="${locals.user.id}"`;

		if (projectId && projectId !== 'null' && projectId !== 'undefined') {
			filter += ` && project_id="${projectId}"`;
		}

		if (filters?.status && Array.isArray(filters.status) && filters.status.length > 0) {
			const statusFilter = filters.status.map(s => `status="${s}"`).join(' || ');
			filter += ` && (${statusFilter})`;
		} else {
			filter += ` && status!="archive"`;
		}

		if (filters?.priority && Array.isArray(filters.priority) && filters.priority.length > 0) {
			const priorityFilter = filters.priority.map(p => `priority="${p}"`).join(' || ');
			filter += ` && (${priorityFilter})`;
		}

		if (filters?.assignedTo && Array.isArray(filters.assignedTo) && filters.assignedTo.length > 0) {
			const assigneeFilter = filters.assignedTo.map(a => `assignedTo="${a}"`).join(' || ');
			filter += ` && (${assigneeFilter})`;
		}

		// Date range filters
		if (filters?.dateRange?.start) {
			filter += ` && created>="${filters.dateRange.start}"`;
		}
		if (filters?.dateRange?.end) {
			filter += ` && created<="${filters.dateRange.end}"`;
		}

		console.log('Custom hierarchy filter:', filter);

		const tasksResult = await pbTryCatch(
			pb.collection('tasks').getList(1, 1000, {
				filter,
				sort: '-created'
			}),
			'fetch filtered tasks for hierarchy'
		);

		if (isFailure(tasksResult)) {
			throw new Error(tasksResult.error);
		}

		const tasks = tasksResult.data;
		const taskItems = tasks.items as Task[];

		// Build hierarchy based on type
		let hierarchyData;

		switch (type) {
			case 'status':
				hierarchyData = buildStatusHierarchy(taskItems);
				break;
			case 'priority':
				hierarchyData = buildPriorityHierarchy(taskItems);
				break;
			case 'assignee':
				hierarchyData = buildAssigneeHierarchy(taskItems);
				break;
			case 'timeline':
				hierarchyData = buildTimelineHierarchy(taskItems);
				break;
			default:
				hierarchyData = buildStatusHierarchy(taskItems);
		}

		return hierarchyData;

	}, 'Failed to generate custom hierarchy', 500);
};

// Helper functions for different hierarchy types
function buildStatusHierarchy(tasks: Task[]) {
	const statusGroups: { [key: string]: Task[] } = {};
	
	tasks.forEach((task) => {
		const status = task.status || 'unknown';
		if (!statusGroups[status]) {
			statusGroups[status] = [];
		}
		statusGroups[status].push(task);
	});

	const children = Object.entries(statusGroups).map(([status, statusTasks]) => ({
		name: status.charAt(0).toUpperCase() + status.slice(1),
		value: statusTasks.length,
		children: statusTasks.map((task) => ({
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
		name: 'Task Status Distribution',
		children
	};
}

function buildPriorityHierarchy(tasks: Task[]) {
	const priorityGroups: { [key: string]: Task[] } = {};
	
	tasks.forEach((task) => {
		const priority = task.priority || 'medium';
		if (!priorityGroups[priority]) {
			priorityGroups[priority] = [];
		}
		priorityGroups[priority].push(task);
	});

	const children = Object.entries(priorityGroups).map(([priority, priorityTasks]) => ({
		name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
		value: priorityTasks.length,
		children: priorityTasks.map((task) => ({
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
		name: 'Task Priority Distribution',
		children
	};
}

function buildAssigneeHierarchy(tasks: Task[]) {
	const assigneeGroups: { [key: string]: Task[] } = {};
	
	tasks.forEach((task) => {
		const assignee = task.assignedTo || 'unassigned';
		if (!assigneeGroups[assignee]) {
			assigneeGroups[assignee] = [];
		}
		assigneeGroups[assignee].push(task);
	});

	const children = Object.entries(assigneeGroups).map(([assignee, assigneeTasks]) => ({
		name: assignee === 'unassigned' ? 'Unassigned' : `Assignee: ${assignee}`,
		value: assigneeTasks.length,
		children: assigneeTasks.map((task) => ({
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
		name: 'Task Assignment Distribution',
		children
	};
}

function buildTimelineHierarchy(tasks: Task[]) {
	const timeGroups: { [key: string]: Task[] } = {
		'overdue': [],
		'this_week': [],
		'next_week': [],
		'this_month': [],
		'later': [],
		'no_due_date': []
	};
	
	const now = new Date();
	const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
	const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	tasks.forEach((task) => {
		if (!task.due_date) {
			timeGroups['no_due_date'].push(task);
			return;
		}

		const dueDate = new Date(task.due_date);
		
		if (dueDate < now) {
			timeGroups['overdue'].push(task);
		} else if (dueDate <= weekFromNow) {
			timeGroups['this_week'].push(task);
		} else if (dueDate <= twoWeeksFromNow) {
			timeGroups['next_week'].push(task);
		} else if (dueDate <= monthFromNow) {
			timeGroups['this_month'].push(task);
		} else {
			timeGroups['later'].push(task);
		}
	});

	const timeLabels = {
		'overdue': 'Overdue',
		'this_week': 'This Week',
		'next_week': 'Next Week',
		'this_month': 'This Month',
		'later': 'Later',
		'no_due_date': 'No Due Date'
	};

	const children = Object.entries(timeGroups)
		.filter(([_, tasks]) => tasks.length > 0)
		.map(([timeKey, timeTasks]) => ({
			name: timeLabels[timeKey as keyof typeof timeLabels],
			value: timeTasks.length,
			children: timeTasks.map((task) => ({
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
		name: 'Task Timeline Distribution',
		children
	};
}