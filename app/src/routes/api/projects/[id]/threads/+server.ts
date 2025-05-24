// src/routes/api/projects/[id]/threads/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Threads, Projects } from '$lib/types/types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const projectId = params.id;

	console.log(`API projects/[id]/threads: Fetching threads for project ${projectId}`);

	// Authentication check
	if (!locals.user) {
		console.error('API: User not authenticated');
		return json(
			{
				success: false,
				message: 'Authentication required'
			},
			{ status: 401 }
		);
	}

	// PocketBase instance check
	if (!locals.pb) {
		console.error('API: PocketBase client not available');
		return json(
			{
				success: false,
				message: 'Server error'
			},
			{ status: 500 }
		);
	}

	const currentUserId = locals.user.id;

	try {
		let project: Projects;
		try {
			project = await locals.pb.collection('projects').getOne<Projects>(projectId);
			console.log(
				`API: Found project: ${project.id} with ${project.threads?.length || 0} thread references`
			);
		} catch (err) {
			console.error('API: Project not found:', err);
			return json(
				{
					success: false,
					message: 'Project not found'
				},
				{ status: 404 }
			);
		}

		const isOwner = project.owner === currentUserId;
		const isCollaborator =
			Array.isArray(project.collaborators) && project.collaborators.includes(currentUserId);

		if (!isOwner && !isCollaborator) {
			console.error('API: User does not have permission');
			return json(
				{
					success: false,
					message: 'Access denied'
				},
				{ status: 403 }
			);
		}

		let threads: Threads[] = [];
		const foundThreadIds = new Set<string>();

		try {
			const directThreads = await locals.pb.collection('threads').getFullList<Threads>({
				filter: `(project = "${projectId}" || project.id = "${projectId}" || project_id = "${projectId}" || project_id.id = "${projectId}")`,
				sort: '-created',
				expand: 'project,project_id'
			});

			console.log(`API: Found ${directThreads.length} threads with direct project reference`);

			// Add these threads and track their IDs
			directThreads.forEach((thread) => {
				foundThreadIds.add(thread.id);
				threads.push({
					...thread,
					project: projectId,
					project_id: projectId
				});
			});
		} catch (fetchError) {
			console.error('API: Error fetching direct threads:', fetchError);
		}

		if (project.threads && Array.isArray(project.threads) && project.threads.length > 0) {
			try {
				const missingThreadIds = project.threads.filter((id) => !foundThreadIds.has(id));

				if (missingThreadIds.length > 0) {
					console.log(
						`API: Fetching ${missingThreadIds.length} additional threads from project.threads array`
					);

					const idFilter = missingThreadIds.map((id) => `id = "${id}"`).join(' || ');

					const additionalThreads = await locals.pb.collection('threads').getFullList<Threads>({
						filter: idFilter,
						sort: '-created'
					});

					console.log(
						`API: Found ${additionalThreads.length} additional threads from project.threads array`
					);

					additionalThreads.forEach((thread) => {
						if (!foundThreadIds.has(thread.id)) {
							foundThreadIds.add(thread.id);
							threads.push({
								...thread,
								project: projectId,
								project_id: projectId
							});
						}
					});
				}
			} catch (additionalError) {
				console.error('API: Error fetching additional threads:', additionalError);
			}
		}

		console.log(`API: Total threads found: ${threads.length}`);

		if (threads.length === 0) {
			console.log('API: No threads found, creating default thread');
			try {
				const defaultThread = await locals.pb.collection('threads').create<Threads>({
					name: 'General Discussion',
					op: currentUserId,
					current_thread: true,
					project: projectId,
					project_id: projectId,
					agents: [],
					user: currentUserId,
					members: [currentUserId],
					created: new Date().toISOString(),
					updated: new Date().toISOString()
				});

				threads = [defaultThread];
				console.log('API: Default thread created:', defaultThread.id);

				try {
					await locals.pb.collection('projects').update(projectId, {
						threads: [...(project.threads || []), defaultThread.id]
					});
					console.log('API: Updated project with new thread reference');
				} catch (updateError) {
					console.error('API: Failed to update project with thread reference:', updateError);
				}
			} catch (createError) {
				console.error('API: Error creating default thread:', createError);
			}
		}

		return json({
			success: true,
			threads: threads,
			data: threads
		});
	} catch (err) {
		console.error('API: Unexpected error:', err);
		return json(
			{
				success: false,
				message: 'Server error',
				error: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
