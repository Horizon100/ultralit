// src/routes/api/tasks/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { params, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		console.log(`Fetching task ${params.id}...`);

		const task = await pb.collection('tasks').getOne(params.id);

		if (task.createdBy !== locals.user.id) {
			if (task.project_id) {
				const project = await pb.collection('projects').getOne(task.project_id);
				if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
					throw new Error('Unauthorized');
				}
			} else {
				throw new Error('Unauthorized');
			}
		}

		return task;
	}, 'Failed to fetch task');

export const PATCH: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { params, request, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const data = await request.json();
		const task = await pb.collection('tasks').getOne(params.id);

		if (task.createdBy !== locals.user.id) {
			if (task.project_id) {
				const project = await pb.collection('projects').getOne(task.project_id);
				if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
					throw new Error('Unauthorized');
				}
			} else {
				throw new Error('Unauthorized');
			}
		}

		const updatedTask = await pb.collection('tasks').update(params.id, data);
		return updatedTask;
	}, 'Failed to update task');

export const DELETE: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { params, locals } = event;

		if (!locals.user) {
			throw new Error('Unauthorized');
		}

		const task = await pb.collection('tasks').getOne(params.id);

		if (task.createdBy !== locals.user.id) {
			if (task.project_id) {
				const project = await pb.collection('projects').getOne(task.project_id);
				if (project.owner !== locals.user.id) {
					throw new Error('Unauthorized');
				}
			} else {
				throw new Error('Unauthorized');
			}
		}

		await pb.collection('tasks').delete(params.id);
		return { success: true };
	}, 'Failed to delete task');
