// src/routes/api/projects/[id]/threads/[threadId]/+server.ts

import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		// First get the project to verify access
		const project = await pb.collection('projects').getOne(params.id);

		// Verify access
		if (project.owner !== locals.user.id && !project.collaborators?.includes(locals.user.id)) {
			throw error(403, 'Forbidden');
		}

		// Get the thread to verify ownership
		const thread = await pb.collection('threads').getOne(params.threadId);

		// Verify thread belongs to this project
		if (thread.project !== params.id) {
			throw error(400, 'Thread does not belong to this project');
		}

		// Remove thread from project (set project to null)
		const updated = await pb.collection('threads').update(params.threadId, {
			project: null
		});

		return json({
			success: true,
			data: updated
		});
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : 'Failed to remove thread from project');
	}
};
