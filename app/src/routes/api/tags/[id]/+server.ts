// src/routes/api/tags/[id]/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Update a tag
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Check if user can update this tag
		const tag = await pb.collection('tags').getOne(params.id);

		if (tag.createdBy !== locals.user.id) {
			// Check if user has access to any of the projects tagged
			if (tag.taggedProjects) {
				/*
				 * If the tag is related to projects, check if user has permissions
				 * on any of those projects
				 */
				const projectIds = tag.taggedProjects.split(',');
				let hasAccess = false;

				for (const projectId of projectIds) {
					if (!projectId) continue;

					try {
						const project = await pb.collection('projects').getOne(projectId);
						if (
							project.owner === locals.user.id ||
							(project.collaborators && project.collaborators.includes(locals.user.id))
						) {
							hasAccess = true;
							break;
						}
					} catch (err) {
						console.error(`Error updating tag ${params.id}:`, err);
						return new Response(
							JSON.stringify({
								error: err instanceof Error ? err.message : 'Failed to update tag'
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' }
							}
						);
					}
				}

				if (!hasAccess) {
					return new Response(JSON.stringify({ error: 'Unauthorized' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			} else {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		const data = await request.json();

		// Update the tag
		const updatedTag = await pb.collection('tags').update(params.id, data);

		return json(updatedTag);
	} catch (error) {
		console.error('Error in handler:', error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Internal server error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

// Delete a tag
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Check if user can delete this tag
		const tag = await pb.collection('tags').getOne(params.id);

		if (tag.createdBy !== locals.user.id) {
			// Check if user has access to any of the projects tagged
			if (tag.taggedProjects) {
				/*
				 * If the tag is related to projects, check if user has permissions
				 * on any of those projects
				 */
				const projectIds = tag.taggedProjects.split(',');
				let hasOwnerAccess = false;

				for (const projectId of projectIds) {
					if (!projectId) continue;

					try {
						const project = await pb.collection('projects').getOne(projectId);
						if (project.owner === locals.user.id) {
							hasOwnerAccess = true;
							break;
						}
					} catch (err) {
						console.warn(
							`Could not check project ${projectId}: ${err instanceof Error ? err.message : 'Unknown error'}`
						);
					}
				}

				if (!hasOwnerAccess) {
					return new Response(JSON.stringify({ error: 'Unauthorized' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			} else {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Delete the tag
		await pb.collection('tags').delete(params.id);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting tag:', error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Internal server error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
