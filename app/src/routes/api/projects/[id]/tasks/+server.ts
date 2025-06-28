// src/routes/api/projects/[id]/tasks/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async (event) => {
	return apiTryCatch(async () => {
		const { params, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		// Check if user has access to this project
		const project = await pb.collection('projects').getOne(params.id);

		if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
			throw new Error('Unauthorized');
		}

		// Get all tasks for this project
		const tasks = await pb.collection('tasks').getList(1, 100, {
			filter: `project_id="${params.id}" && status!="archive"`,
			sort: '-created',
			expand: 'createdBy,allocatedAgents'
		});

		return tasks;
	}, 'Error fetching project tasks');
};

export const POST: RequestHandler = async (event) => {
	return apiTryCatch(async () => {
		const { params, request, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		// Check if user has access to this project
		const project = await pb.collection('projects').getOne(params.id);

		if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
			throw new Error('Unauthorized');
		}

		const data = await request.json();

		// Ensure project_id and createdBy are set
		data.project_id = params.id;
		data.createdBy = locals.user.id;

		// Create the task
		const task = await pb.collection('tasks').create(data);

		// Update project's tasks reference (if needed)
		if (project.threads && !project.threads.includes(task.id)) {
			project.threads.push(task.id);
			await pb.collection('projects').update(params.id, { threads: project.threads });
		}

		return task;
	}, 'Error creating project task');
};
