// src/routes/api/projects/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		const projects = await locals.pb.collection('projects').getFullList({
			filter: `owner = "${locals.user.id}" || collaborators ~ "${locals.user.id}"`,
			expand: 'owner,collaborators'
		});
		return json({ success: true, data: projects });
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : 'Unknown error');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		const { name, description } = await request.json();

		const newProject = await locals.pb.collection('projects').create({
			name,
			description,
			owner: locals.user.id,
			collaborators: [locals.user.id]
		});

		return json({
			success: true,
			data: newProject
		});
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : 'Failed to create project');
	}
};
