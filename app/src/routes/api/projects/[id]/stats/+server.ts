// src/routes/api/projects/[id]/stats/+server.ts
import { pb } from '$lib/server/pocketbase';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		// First verify the user has access to this project
		const project = await pb.collection('projects').getOne(params.id);
		
		if (project.owner !== locals.user.id && !project.collaborators?.includes(locals.user.id)) {
			throw error(403, 'Forbidden - No access to this project');
		}

		// Fetch stats in parallel for better performance
		const [
			messagesResult,
			documentsResult,
			tasksResult,
			completedTasksResult,
			lastMessageResult
		] = await Promise.allSettled([
			// Messages count
			pb.collection('messages').getList(1, 1, {
				filter: `project = "${params.id}"`,
				$autoCancel: false
			}),
			// Documents count
			pb.collection('documents').getList(1, 1, {
				filter: `project = "${params.id}"`,
				$autoCancel: false
			}),
			// Total tasks count
			pb.collection('tasks').getList(1, 1, {
				filter: `project = "${params.id}"`,
				$autoCancel: false
			}),
			// Completed tasks count
			pb.collection('tasks').getList(1, 1, {
				filter: `project = "${params.id}" && status = "completed"`,
				$autoCancel: false
			}),
			// Last message for activity tracking
			pb.collection('messages').getList(1, 1, {
				filter: `project = "${params.id}"`,
				sort: '-created',
				$autoCancel: false
			})
		]);

		// Extract counts safely
		const messageCount = messagesResult.status === 'fulfilled' ? messagesResult.value.totalItems : 0;
		const documentCount = documentsResult.status === 'fulfilled' ? documentsResult.value.totalItems : 0;
		const totalTasks = tasksResult.status === 'fulfilled' ? tasksResult.value.totalItems : 0;
		const completedTasks = completedTasksResult.status === 'fulfilled' ? completedTasksResult.value.totalItems : 0;
		
		// Calculate completion percentage
		const completionPercentage = totalTasks > 0 ? Math.min(Math.round((completedTasks / totalTasks) * 100), 100) : 0;
		
		// Get last active time
		let lastActive: string | null = null;
		if (lastMessageResult.status === 'fulfilled' && lastMessageResult.value.items.length > 0) {
			lastActive = lastMessageResult.value.items[0].created;
		}

		// Get collaborator count from project
		const collaboratorCount = Array.isArray(project.collaborators) ? project.collaborators.length : 0;

		const stats = {
			messageCount,
			documentCount,
			collaboratorCount,
			completionPercentage,
			lastActive,
			totalTasks,
			completedTasks
		};

		return json({ 
			success: true, 
			data: stats 
		});

	} catch (err) {
		console.error('Error fetching project stats:', err);
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch project stats';
		throw error(400, errorMessage);
	}
};