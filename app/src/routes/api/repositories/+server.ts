// src/routes/api/repositories/+server.ts
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const data = await request.json();

	// Validate required fields
	if (!data?.repoName || !data?.project) {
		return json({ error: 'Repository name and project are required' }, { status: 400 });
	}

	try {
		// Verify project exists and user has access
		const project = await pb.collection('projects').getOne(data.project);
		if (project.owner !== locals.user.id && !project.collaborators?.includes(locals.user.id)) {
			return json({ error: 'Unauthorized for this project' }, { status: 403 });
		}

		// Create repository
		const repo = await pb.collection('repositories').create({
			repoName: data.repoName,
			project: data.project,
			createdBy: locals.user.id,
			defaultBranch: 'main',
			isPublic: false
		});

		// Create root folder
		await pb.collection('code_folders').create({
			name: 'root',
			path: '/',
			repository: repo.id,
			branch: 'main',
			createdBy: locals.user.id
		});

		return json(repo);
	} catch (err) {
		return json(
			{
				error: 'Failed to create repository',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Get all repositories accessible to the user
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get query parameters
		const projectId = url.searchParams.get('projectId');
		const userId = url.searchParams.get('userId');
		const isPublic = url.searchParams.get('isPublic');

		// Build filter
		let filter = `(createdBy="${locals.user.id}" || repoCollaborators~"${locals.user.id}"`;
		filter += isPublic === 'true' ? ' || isPublic=true)' : ')';

		if (projectId) {
			filter += ` && project="${projectId}"`;
		}

		if (userId) {
			filter += ` && createdBy="${userId}"`;
		}

		// Fetch repositories with filter
		const repositories = await pb.collection('repositories').getList(1, 100, {
			filter,
			sort: '-created',
			expand: 'createdBy,project'
		});

		return json(repositories);
	} catch (error) {
		console.error('Error fetching repositories:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch repositories',
				details: error instanceof Error ? error.message : String(error)
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
