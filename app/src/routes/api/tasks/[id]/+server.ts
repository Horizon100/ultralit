// src/routes/api/tasks/[id]/+server.ts - Fixed TypeScript errors
import { json } from '@sveltejs/kit';
import { pb } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

// Type for PocketBase errors
interface PocketBaseError extends Error {
	status?: number;
	data?: unknown;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Let PocketBase rules handle authorization
		const task = await pb.collection('tasks').getOne(params.id);
		return json(task);
	} catch (err) {
		// PocketBase returns 404 for both not found and unauthorized
		const pbError = err as PocketBaseError;
		if (pbError.status === 404) {
			return new Response(
				JSON.stringify({
					error: 'Task not found or access denied'
				}),
				{ status: 404, headers: { 'Content-Type': 'application/json' } }
			);
		}
		throw err;
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const data = await request.json();

		// Get old task data for assignment tracking
		const oldTask = await pb.collection('tasks').getOne(params.id);

		// Update via PocketBase (rules handle authorization)
		const updatedTask = await pb.collection('tasks').update(params.id, data);

		// Handle assignment changes (your business logic)
		if (data.assignedTo !== undefined && data.assignedTo !== oldTask.assignedTo) {
			await handleAssignmentChange(oldTask, updatedTask);
		}

		return json(updatedTask);
	} catch (err) {
		const pbError = err as PocketBaseError;
		if (pbError.status === 404) {
			return new Response(
				JSON.stringify({
					error: 'Task not found or access denied'
				}),
				{ status: 404, headers: { 'Content-Type': 'application/json' } }
			);
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Get task info for cleanup BEFORE deleting
		let task = null;
		try {
			task = await pb.collection('tasks').getOne(params.id);
		} catch {
			/*
			 * If we can't get the task, user probably can't delete it either
			 * Continue to attempt delete to get proper error from PocketBase
			 */
		}

		// Delete via PocketBase (rules handle authorization)
		await pb.collection('tasks').delete(params.id);

		// Clean up user assignments (your business logic)
		if (task?.assignedTo) {
			await cleanupUserAssignment(task.assignedTo, params.id, task.status);
		}

		return json({ success: true });
	} catch (err) {
		const pbError = err as PocketBaseError;
		if (pbError.status === 404) {
			return new Response(
				JSON.stringify({
					error:
						'Task not found or you cannot delete it. Only task creators and project owners can delete tasks.'
				}),
				{ status: 404, headers: { 'Content-Type': 'application/json' } }
			);
		}
		throw err;
	}
};

// Helper function for your business logic
async function handleAssignmentChange(
	oldTask: Record<string, unknown>,
	newTask: Record<string, unknown>
) {
	// Remove from old assignee
	if (oldTask.assignedTo && typeof oldTask.assignedTo === 'string') {
		await cleanupUserAssignment(oldTask.assignedTo, oldTask.id as string, oldTask.status as string);
	}
	// Add to new assignee
	if (newTask.assignedTo && typeof newTask.assignedTo === 'string') {
		await addUserAssignment(newTask.assignedTo, newTask.id as string, newTask.status as string);
	}
}

// Placeholder functions - you should import these from your existing taskClient.ts
async function cleanupUserAssignment(userId: string, taskId: string, status: string) {
	// TODO: Import and use your existing removeTaskFromUser function
	console.log('TODO: Remove task assignment', { userId, taskId, status });
}

async function addUserAssignment(userId: string, taskId: string, status: string) {
	// TODO: Import and use your existing updateUserTaskAssignment function
	console.log('TODO: Add task assignment', { userId, taskId, status });
}
