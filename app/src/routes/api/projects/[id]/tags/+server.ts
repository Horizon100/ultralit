// src/routes/api/projects/[id]/tags/+server.ts
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';

// Get all tags for a specific project
export const GET: RequestHandler = async ({ params, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const project = await pb.collection('projects').getOne(params.id);

			if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
				throw new Error('Forbidden');
			}

			const tags = await pb.collection('tags').getList(1, 100, {
				filter: `taggedProjects~"${params.id}"`,
				sort: 'name'
			});

			return tags;
		},
		'Failed to fetch project tags',
		500
	);

// Create a new tag in this project
export const POST: RequestHandler = async ({ params, request, locals }) =>
	apiTryCatch(
		async () => {
			if (!locals.user) {
				throw new Error('Unauthorized');
			}

			const project = await pb.collection('projects').getOne(params.id);

			if (project.owner !== locals.user.id && !project.collaborators.includes(locals.user.id)) {
				throw new Error('Forbidden');
			}

			const data = await request.json();

			data.createdBy = locals.user.id;
			data.taggedProjects = params.id;

			const tag = await pb.collection('tags').create(data);

			return tag;
		},
		'Failed to create project tag',
		500
	);
