// src/lib/clients/taskClient.ts
import { get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import type { KanbanTask, KanbanColumn, Task, InternalChatMessage } from '$lib/types/types';
import {
	clientTryCatch,
	validationTryCatch,
	isSuccess,
	isFailure,
	type Result
} from '$lib/utils/errorUtils';
interface RawTaskData {
	id: string;
	title: string;
	taskDescription?: string;
	created: string;
	due_date?: string;
	start_date?: string;
	taskTags?: string[];
	taggedTasks?: string;
	attachments?: Array<{
		id: string;
		fileName: string;
		url?: string;
		note?: string;
	}>;
	project_id: string;
	createdBy: string;
	assignedTo?: string;
	parent_task?: string;
	allocatedAgents?: string[];
	status:
		| 'backlog'
		| 'todo'
		| 'inprogress'
		| 'review'
		| 'done'
		| 'hold'
		| 'postpone'
		| 'delegate'
		| 'cancel'
		| 'archive';
	priority?: 'high' | 'medium' | 'low';
	prompt?: string;
	context?: string;
	task_outcome?: string;
	dependencies?: Array<
		| string
		| {
				type: 'dependency' | 'subtask' | 'resource' | 'precedence';
				task_id: string;
		  }
	>;
	agentMessages?: string[];
}
let currentProjectId: string | null = null;
let columns: Writable<KanbanColumn[]>;

export function setCurrentProjectId(projectId: string | null) {
	currentProjectId = projectId;
}

export function setColumnsStore(columnsStore: Writable<KanbanColumn[]>) {
	columns = columnsStore;
}

/**
 * Saves a task to the database
 * @param task Task object to save
 * @returns Promise with the saved task data
 */
export async function saveTask(task: KanbanTask): Promise<Task> {
	try {
		// Handle file attachments first if the task has any
		const attachmentPromises = task.attachments
			.filter((att) => att.file)
			.map(async (att) => {
				const formData = new FormData();

				// Add null checks
				if (att.file) {
					formData.append('file', att.file);
				}
				formData.append('fileName', att.fileName);
				if (att.note) formData.append('note', att.note);

				const currentUserValue = get(currentUser)?.id;
				if (currentUserValue) {
					formData.append('createdBy', currentUserValue);
				}

				if (task.id && !task.id.startsWith('local_')) {
					formData.append('attachedTasks', task.id);
				}

				if (task.project_id) {
					formData.append('attachedProjects', task.project_id);
				}

				const response = await fetch('/api/attachments', {
					method: 'POST',
					body: formData
				});

				if (!response.ok) throw new Error('Failed to upload attachment');

				const savedAttachment = await response.json();
				return {
					id: savedAttachment.id,
					fileName: att.fileName,
					url: savedAttachment.url || '',
					note: att.note
				};
			});

		const savedAttachments = await Promise.all(attachmentPromises);

		const updatedAttachments = task.attachments.map((att) => {
			if (att.file) {
				const savedAtt = savedAttachments.find((sa) => sa.fileName === att.fileName);
				return savedAtt || att;
			}
			return att;
		});

		const attachmentIds = updatedAttachments.map((att) => att.id).join(',');

		const taskData = {
			title: task.title,
			taskDescription: task.taskDescription,
			project_id: task.project_id || '',
			createdBy: get(currentUser)?.id,
			parent_task: task.parent_task || '',
			status: task.status,
			priority: task.priority || 'medium',
			due_date: task.due_date ? task.due_date.toISOString() : null,
			start_date: task.start_date ? task.start_date.toISOString() : null,
			taggedTasks: task.tags.join(','),
			taskTags: task.tags,
			allocatedAgents: task.allocatedAgents || [],
			attachments: attachmentIds,
			prompt: task.prompt || '',
			context: task.context || '',
			task_outcome: task.task_outcome || '',
			dependencies: task.dependencies || [],
			agentMessages: task.agentMessages || [],
			assignedTo: task.assignedTo || ''
		};

		let url = '/api/tasks';
		let method = 'POST';

		if (task.id && !task.id.startsWith('local_')) {
			url = `/api/tasks/${task.id}`;
			method = 'PATCH';
		}

		const response = await fetch(url, {
			method,
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(taskData)
		});

		if (!response.ok) throw new Error('Failed to save task');

		const savedTask = await response.json();

		// If task is assigned to a user, update the user's task assignments
		if (savedTask.assignedTo) {
			await updateUserTaskAssignment(savedTask.assignedTo, savedTask.id, savedTask.status);
		}

		return {
			...savedTask,
			id: savedTask.id,
			attachments: updatedAttachments,
			creationDate: new Date(savedTask.created),
			due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
			start_date: savedTask.start_date ? new Date(savedTask.start_date) : null,
			tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : []
		};
	} catch (err) {
		console.error('Error saving task:', err);
		throw err;
	}
}

/**
 * Creates a task from an AI message
 * @param message The message object to create a task from
 * @param promptMessage Optional original prompt message
 * @param projectId Optional project ID to associate the task with
 * @returns Promise with the created task
 */
export async function createTaskFromMessage(
	message: InternalChatMessage,
	promptMessage?: InternalChatMessage | null,
	projectId?: string
): Promise<Result<Task, string>> {
	// Validate inputs
	const validation = validationTryCatch(() => {
		if (!message) {
			throw new Error('Message is required');
		}
		if (!message.content?.trim()) {
			throw new Error('Message content is required');
		}
		if (!message.id) {
			throw new Error('Message ID is required');
		}

		const user = get(currentUser);
		if (!user?.id) {
			throw new Error('User not authenticated');
		}

		return {
			message: {
				...message,
				content: message.content.trim()
			},
			promptMessage,
			projectId,
			user
		};
	}, 'task creation input validation');

	if (isFailure(validation)) {
		return { data: null, error: validation.error, success: false };
	}

	const { message: validMessage, user } = validation.data;

	// Process task title and description
	const taskDataResult = validationTryCatch(() => {
		// Extract title from first sentence, limiting to 50 characters
		let title = validMessage.content.split('.')[0].trim();
		if (title.length > 50) {
			title = title.substring(0, 47) + '...';
		}

		if (!title) {
			// Fallback if no sentence structure
			title =
				validMessage.content.substring(0, 47) + (validMessage.content.length > 47 ? '...' : '');
		}

		return {
			title,
			description: validMessage.content
		};
	}, 'task data processing');

	if (isFailure(taskDataResult)) {
		return { data: null, error: taskDataResult.error, success: false };
	}

	const { title, description } = taskDataResult.data;

	// Create task object
	const taskCreationResult = validationTryCatch(() => {
		const newTask: KanbanTask = {
			id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
			title,
			taskDescription: description,
			creationDate: new Date(),
			due_date: null,
			start_date: null,
			tags: [],
			attachments: [],
			project_id: projectId || '',
			createdBy: user.id,
			allocatedAgents: [],
			status: 'todo',
			priority: 'medium',
			prompt: promptMessage?.content || '',
			context: '',
			task_outcome: '',
			dependencies: [],
			agentMessages: [validMessage.id],
			assignedTo: ''
		};

		return newTask;
	}, 'task object creation');

	if (isFailure(taskCreationResult)) {
		return { data: null, error: taskCreationResult.error, success: false };
	}

	const newTask = taskCreationResult.data;

	// Save the task
	const saveResult = await clientTryCatch(saveTask(newTask), 'Saving task to database');

	if (isFailure(saveResult)) {
		return { data: null, error: saveResult.error, success: false };
	}

	return { data: saveResult.data, error: null, success: true };
}
/**
 * Updates an existing task
 * @param taskId ID of the task to update
 * @param updateData Data to update on the task
 * @returns Promise with the updated task
 */
export async function updateTask(taskId: string, updateData: Partial<Task>): Promise<Task> {
	try {
		// Get the current task to track changes
		const taskResponse = await fetch(`/api/tasks/${taskId}`);
		if (!taskResponse.ok) throw new Error('Failed to fetch task data');

		const oldTask = await taskResponse.json();

		// Make the update request
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updateData)
		});

		if (!response.ok) throw new Error('Failed to update task');

		const updatedTask = await response.json();

		// Handle assignment changes
		if (updateData.assignedTo !== undefined && updateData.assignedTo !== oldTask.assignedTo) {
			// If previously assigned to someone else, remove from old user
			if (oldTask.assignedTo) {
				await removeTaskFromUser(oldTask.assignedTo, taskId, oldTask.status);
			}

			// If now assigned to someone new, add to new user
			if (updateData.assignedTo) {
				await updateUserTaskAssignment(
					updateData.assignedTo,
					taskId,
					updateData.status || oldTask.status
				);
			}
		}

		// Handle status changes for assigned tasks
		if (
			updateData.status !== undefined &&
			updateData.status !== oldTask.status &&
			(oldTask.assignedTo || updateData.assignedTo)
		) {
			// Use the assigned user, prioritizing the new assignee if changed
			const userId =
				updateData.assignedTo !== undefined ? updateData.assignedTo : oldTask.assignedTo;

			// Only update if there's a user assigned
			if (userId) {
				await updateUserTaskStatus(userId, oldTask.status, updateData.status, taskId);
			}
		}

		return updatedTask;
	} catch (err) {
		console.error('Error updating task:', err);
		throw err;
	}
}

/**
 * Updates the tags associated with a task
 * @param taskId ID of the task to update
 * @param tagIds Array of tag IDs to associate with the task
 * @param taskDescription Optional updated task description
 * @returns Promise with the updated task
 */
export async function updateTaskTags(
	taskId: string,
	tagIds: string[],
	taskDescription?: string
): Promise<Task> {
	try {
		// Replace 'any' with proper interface
		const updateData: {
			taggedTasks: string;
			taskTags: string[];
			taskDescription?: string;
		} = {
			taggedTasks: tagIds.join(','),
			taskTags: tagIds
		};

		// If taskDescription is provided, update it as well
		if (taskDescription !== undefined) {
			updateData.taskDescription = taskDescription;
		}

		// Update the task
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updateData)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Server error (${response.status}):`, errorText);
			throw new Error(`Failed to update task tags: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	} catch (err) {
		console.error('Error updating task tags:', err);
		throw err;
	}
}

/**
 * Deletes a task
 * @param taskId ID of the task to delete
 * @returns Promise that resolves when the task is deleted
 */
export async function deleteTask(taskId: string): Promise<void> {
	try {
		// Check if task is local only
		if (taskId.startsWith('local_')) {
			return;
		}

		// Get the current task to check for assignments
		const taskResponse = await fetch(`/api/tasks/${taskId}`);
		let task: Task | null = null;

		if (taskResponse.ok) {
			task = await taskResponse.json();

			// Add null check before accessing task properties
			if (task && task.assignedTo) {
				await removeTaskFromUser(task.assignedTo, taskId, task.status);
			}
		}

		const response = await fetch(`/api/tasks/${taskId}`, {
			method: 'DELETE'
		});

		if (!response.ok) throw new Error('Failed to delete task');
	} catch (err) {
		console.error('Error deleting task:', err);
		throw err;
	}
}
/**
 * Loads tasks for a specific project
 * @param projectId The project ID to filter tasks by
 * @returns Promise with the loaded tasks
 */
export async function loadProjectTasks(projectId: string): Promise<KanbanTask[]> {
	try {
		const response = await fetch(`/api/projects/${projectId}/tasks`, {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch tasks for project: ${response.status}`);
		}

		const data = await response.json();

		// Check if the response has the tasks in different possible locations
		const tasks: RawTaskData[] = data.tasks || data.items || data.data || [];

		// Transform the tasks to match KanbanTask interface
		return tasks.map(
			(task: RawTaskData): KanbanTask => ({
				id: task.id,
				title: task.title,
				taskDescription: task.taskDescription || '',
				creationDate: new Date(task.created),
				due_date: task.due_date ? new Date(task.due_date) : null,
				start_date: task.start_date ? new Date(task.start_date) : null,
				tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
				attachments: (task.attachments || []).map((att) => ({
					id: att.id || '',
					fileName: att.fileName || '',
					url: att.url || '',
					note: att.note
				})),
				project_id: task.project_id,
				createdBy: task.createdBy,
				assignedTo: task.assignedTo || '',
				parent_task: task.parent_task || undefined,
				allocatedAgents: task.allocatedAgents || [],
				status: task.status as Task['status'],
				priority: (task.priority || 'medium') as 'low' | 'medium' | 'high',
				prompt: task.prompt || '',
				context: task.context || '',
				task_outcome: task.task_outcome || '',
				dependencies: (task.dependencies || []).map((dep) =>
					typeof dep === 'string' ? { type: 'dependency' as const, task_id: dep } : dep
				),
				agentMessages: task.agentMessages || []
			})
		);
	} catch (err) {
		console.error('Error loading project tasks:', err);
		throw err;
	}
}
/**
 * Loads tasks for the current user or project
 * @param projectId Optional project ID to filter tasks
 * @returns Promise with the loaded tasks
 */
export async function loadTasks(columnsStore?: Writable<KanbanColumn[]>) {
	try {
		// Use the passed columns store if provided
		const activeColumns = columnsStore || columns;

		if (!activeColumns) {
			throw new Error('No columns store available');
		}

		let url = '/api/tasks';
		if (currentProjectId) {
			url = `/api/projects/${currentProjectId}/tasks`;
		}

		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch tasks');

		const data = await response.json();
		console.log(
			'Task data from API:',
			data.items.map((t: RawTaskData) => ({ id: t.id, title: t.title, assignedTo: t.assignedTo }))
		);

		// Reset all columns tasks
		activeColumns.update((cols: KanbanColumn[]) => {
			return cols.map((col: KanbanColumn) => ({ ...col, tasks: [] }));
		});

		let allTasksBackup: KanbanTask[] = [];

		// Store all tasks for filtering purposes
		allTasksBackup = [];

		// Distribute tasks to appropriate columns
		activeColumns.update((cols: KanbanColumn[]) => {
			data.items.forEach((task: RawTaskData) => {
				const taskObj: KanbanTask = {
					id: task.id,
					title: task.title,
					taskDescription: task.taskDescription || '',
					creationDate: new Date(task.created),
					due_date: task.due_date ? new Date(task.due_date) : null,
					start_date: task.start_date ? new Date(task.start_date) : null,
					tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
					attachments: (task.attachments || []).map((att) => ({
						id: att.id || '',
						fileName: att.fileName || '',
						url: att.url || '',
						note: att.note
					})),
					project_id: task.project_id,
					createdBy: task.createdBy,
					assignedTo: task.assignedTo || '',
					parent_task: task.parent_task || undefined,
					allocatedAgents: task.allocatedAgents || [],
					status: task.status,
					priority: task.priority || 'medium',
					prompt: task.prompt || '',
					context: task.context || '',
					task_outcome: task.task_outcome || '',
					dependencies: (task.dependencies || []).map((dep) =>
						typeof dep === 'string' ? { type: 'dependency' as const, task_id: dep } : dep
					),
					agentMessages: task.agentMessages || []
				};

				// Add to our backup of all tasks
				allTasksBackup.push(taskObj);

				// Find the appropriate column based on status
				const targetColumn = cols.find((col: KanbanColumn) => col.status === task.status);

				if (targetColumn) {
					targetColumn.tasks.push(taskObj);
				} else {
					// If we can't find a matching column, default to Backlog
					const backlog = cols.find((col: KanbanColumn) => col.status === 'backlog');
					if (backlog) backlog.tasks.push(taskObj);
				}
			});
			return cols;
		});
	} catch (err) {
		console.error('Error loading tasks:', err);
		throw err;
	}
}
export async function loadTasksForGantt(projectId?: string): Promise<Task[]> {
	try {
		let url = '/api/tasks';
		if (projectId) {
			url = `/api/projects/${projectId}/tasks`;
		}

		const response = await fetch(url);
		if (!response.ok) throw new Error('Failed to fetch tasks');

		const data = await response.json();

		// Convert raw task data to Task objects
		const tasks: Task[] = data.items.map((task: RawTaskData) => ({
			id: task.id,
			title: task.title,
			taskDescription: task.taskDescription || '',
			created: task.created,
			due_date: task.due_date,
			start_date: task.start_date,
			taskTags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
			project_id: task.project_id,
			createdBy: task.createdBy,
			assignedTo: task.assignedTo || '',
			parent_task: task.parent_task,
			allocatedAgents: task.allocatedAgents || [],
			status: task.status,
			priority: task.priority || 'medium',
			prompt: task.prompt || '',
			context: task.context || '',
			task_outcome: task.task_outcome || '',
			dependencies: task.dependencies || [],
			agentMessages: task.agentMessages || []
		}));

		return tasks;
	} catch (err) {
		console.error('Error loading tasks for Gantt:', err);
		throw err;
	}
}
/**
 * Gets prompt content from a message thread
 * @param threadId ID of the thread
 * @param allMessages Array of all messages to search
 * @returns The content of the first user message in the thread or empty string
 */
export function getPromptFromThread(threadId: string, allMessages: InternalChatMessage[]): string {
	if (!threadId) return '';

	// Find the first user message in the thread
	const firstUserMessage = allMessages.find(
		(msg) => msg.thread === threadId && msg.role === 'user'
	);

	return firstUserMessage ? firstUserMessage.content : '';
}

/**
 * Gets tasks assigned to a specific user
 * @param userId User ID to get tasks for
 * @returns Promise with the loaded tasks
 */
export async function loadUserTasks(userId: string): Promise<Task[]> {
	try {
		const response = await fetch(`/api/users/${userId}/tasks`);
		if (!response.ok) throw new Error('Failed to fetch user tasks');

		const data = await response.json();
		return data.items;
	} catch (err) {
		console.error('Error loading user tasks:', err);
		throw err;
	}
}

/**
 * Assigns a task to a user
 * @param taskId Task ID to assign
 * @param userId User ID to assign to (empty string to unassign)
 * @returns Promise with the updated task
 */
export async function assignTask(taskId: string, userId: string): Promise<Task> {
	return await updateTask(taskId, { assignedTo: userId });
}

/**
 * Updates a user's task assignments and status counts
 * @param userId User ID to update
 * @param taskId Task ID to add to user's assignments
 * @param taskStatus Status of the task being assigned
 */
async function updateUserTaskAssignment(
	userId: string,
	taskId: string,
	taskStatus: Task['status']
): Promise<void> {
	try {
		console.log(
			`Updating user ${userId} task assignment: adding task ${taskId} with status ${taskStatus}`
		);

		// Use your existing auth system to get user data
		const userResponse = await fetch(`/api/verify/users/${userId}`, {
			credentials: 'include'
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error(`Failed to fetch user ${userId}:`, userResponse.status, errorText);
			throw new Error(
				`Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`
			);
		}

		const responseData = await userResponse.json();

		if (!responseData.success) {
			throw new Error(responseData.error || 'Failed to fetch user data');
		}

		const userData = responseData.user;

		if (!userData || !userData.id) {
			throw new Error('Invalid user data returned from API');
		}

		console.log(`Current user data for ${userId}:`, {
			taskAssignments: userData.taskAssignments?.length || 0,
			userTaskStatus: userData.userTaskStatus
		});

		// Prepare updated assignments
		const taskAssignments = [...(userData.taskAssignments || [])];
		if (!taskAssignments.includes(taskId)) {
			taskAssignments.push(taskId);
		}

		// Prepare updated status counts - ensure all status types are included
		const userTaskStatus = {
			backlog: 0,
			todo: 0,
			inprogress: 0,
			focus: 0,
			done: 0,
			hold: 0,
			postpone: 0,
			cancel: 0,
			review: 0,
			delegate: 0,
			archive: 0,
			...(userData.userTaskStatus || {})
		};

		// Increment the count for this status
		if (taskStatus in userTaskStatus) {
			userTaskStatus[taskStatus as keyof typeof userTaskStatus] =
				(userTaskStatus[taskStatus as keyof typeof userTaskStatus] || 0) + 1;
		} else {
			console.warn(`Unknown task status: ${taskStatus}, adding to userTaskStatus anyway`);
			userTaskStatus[taskStatus as string] = 1;
		}

		const updatePayload = {
			taskAssignments,
			userTaskStatus
		};

		console.log(`Updating user ${userId} with:`, JSON.stringify(updatePayload, null, 2));

		// Use your existing auth system to update the user
		const updateResponse = await fetch(`/api/verify/users/${userId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updatePayload),
			credentials: 'include'
		});

		if (!updateResponse.ok) {
			const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
			console.error(`Failed to update user ${userId}:`, updateResponse.status, errorData);
			throw new Error(
				`Failed to update user task assignments: ${errorData.error || updateResponse.statusText}`
			);
		}

		const updateResult = await updateResponse.json();
		if (!updateResult.success) {
			throw new Error(updateResult.error || 'Update failed');
		}

		console.log(`Successfully updated user ${userId} task assignments`);
	} catch (err) {
		console.error('Error updating user task assignments:', err);
		throw err;
	}
}

/**
 * Removes a task from a user's assignments and updates status counts using your existing auth system
 */
async function removeTaskFromUser(
	userId: string,
	taskId: string,
	taskStatus: Task['status']
): Promise<void> {
	try {
		console.log(`Removing task ${taskId} (status: ${taskStatus}) from user ${userId}`);

		// Use your existing auth system to get user data
		const userResponse = await fetch(`/api/verify/users/${userId}`, {
			credentials: 'include'
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error(`Failed to fetch user ${userId}:`, userResponse.status, errorText);
			throw new Error(
				`Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`
			);
		}

		const responseData = await userResponse.json();

		if (!responseData.success) {
			throw new Error(responseData.error || 'Failed to fetch user data');
		}

		const userData = responseData.user;

		if (!userData || !userData.id) {
			throw new Error('Invalid user data returned from API');
		}

		// Remove task from assignments
		const taskAssignments = (userData.taskAssignments || []).filter((id: string) => id !== taskId);

		// Update status counts - ensure all status types are included
		const userTaskStatus = {
			backlog: 0,
			todo: 0,
			inprogress: 0,
			focus: 0,
			done: 0,
			hold: 0,
			postpone: 0,
			cancel: 0,
			review: 0,
			delegate: 0,
			archive: 0,
			...(userData.userTaskStatus || {})
		};

		// Decrement the count for this status (ensure it doesn't go below 0)
		if (taskStatus in userTaskStatus) {
			userTaskStatus[taskStatus as keyof typeof userTaskStatus] = Math.max(
				0,
				(userTaskStatus[taskStatus as keyof typeof userTaskStatus] || 0) - 1
			);
		} else {
			console.warn(`Unknown task status when removing: ${taskStatus}`);
		}

		const updatePayload = {
			taskAssignments,
			userTaskStatus
		};

		console.log(`Updating user ${userId} (removing task):`, JSON.stringify(updatePayload, null, 2));

		// Use your existing auth system to update the user
		const updateResponse = await fetch(`/api/verify/users/${userId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updatePayload),
			credentials: 'include'
		});

		if (!updateResponse.ok) {
			const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
			console.error(`Failed to update user ${userId}:`, updateResponse.status, errorData);
			throw new Error(
				`Failed to update user task assignments: ${errorData.error || updateResponse.statusText}`
			);
		}

		const updateResult = await updateResponse.json();
		if (!updateResult.success) {
			throw new Error(updateResult.error || 'Update failed');
		}

		console.log(`Successfully removed task ${taskId} from user ${userId}`);
	} catch (err) {
		console.error('Error removing task from user:', err);
		throw err;
	}
}

/**
 * Updates a user's task status counts when a task status changes using your existing auth system
 */
async function updateUserTaskStatus(
	userId: string,
	oldStatus: Task['status'],
	newStatus: Task['status'],
	taskId: string
): Promise<void> {
	try {
		console.log(
			`Updating user ${userId} task status: ${oldStatus} -> ${newStatus} for task ${taskId}`
		);

		// Use your existing auth system to get user data
		const userResponse = await fetch(`/api/verify/users/${userId}`, {
			credentials: 'include'
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error(`Failed to fetch user ${userId}:`, userResponse.status, errorText);
			throw new Error(
				`Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`
			);
		}

		const responseData = await userResponse.json();

		if (!responseData.success) {
			throw new Error(responseData.error || 'Failed to fetch user data');
		}

		const userData = responseData.user;

		if (!userData || !userData.id) {
			throw new Error('Invalid user data returned from API');
		}

		// Ensure user still has this task assigned
		if (!userData.taskAssignments || !userData.taskAssignments.includes(taskId)) {
			console.log(`Task ${taskId} not found in user ${userId} assignments, skipping status update`);
			return;
		}

		// Update status counts - ensure all status types are included
		const userTaskStatus = {
			backlog: 0,
			todo: 0,
			inprogress: 0,
			focus: 0,
			done: 0,
			hold: 0,
			postpone: 0,
			cancel: 0,
			review: 0,
			delegate: 0,
			archive: 0,
			...(userData.userTaskStatus || {})
		};

		// Decrement old status count (ensure it doesn't go below 0)
		if (oldStatus in userTaskStatus) {
			userTaskStatus[oldStatus as keyof typeof userTaskStatus] = Math.max(
				0,
				(userTaskStatus[oldStatus as keyof typeof userTaskStatus] || 0) - 1
			);
		} else {
			console.warn(`Unknown old task status: ${oldStatus}`);
		}

		// Increment new status count
		if (newStatus in userTaskStatus) {
			userTaskStatus[newStatus as keyof typeof userTaskStatus] =
				(userTaskStatus[newStatus as keyof typeof userTaskStatus] || 0) + 1;
		} else {
			console.warn(`Unknown new task status: ${newStatus}, adding anyway`);
			userTaskStatus[newStatus as keyof typeof userTaskStatus] = 1 as unknown as number;
		}

		const updatePayload = {
			userTaskStatus
		};

		console.log(`Updating user ${userId} status counts:`, JSON.stringify(updatePayload, null, 2));

		// Use your existing auth system to update the user
		const updateResponse = await fetch(`/api/verify/users/${userId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updatePayload),
			credentials: 'include'
		});

		if (!updateResponse.ok) {
			const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
			console.error(`Failed to update user ${userId}:`, updateResponse.status, errorData);
			throw new Error(
				`Failed to update user task status counts: ${errorData.error || updateResponse.statusText}`
			);
		}

		const updateResult = await updateResponse.json();
		if (!updateResult.success) {
			throw new Error(updateResult.error || 'Update failed');
		}

		console.log(`Successfully updated user ${userId} task status counts`);
	} catch (err) {
		console.error('Error updating user task status counts:', err);
		throw err;
	}
}

/**
 * Updates a task's status and updates associated user task status counts
 * @param taskId Task ID to update
 * @param newStatus New status for the task
 * @returns Promise with the updated task
 */
export async function updateTaskStatus(taskId: string, newStatus: Task['status']): Promise<Task> {
	try {
		// Get the current task to check for assignment and current status
		const taskResponse = await fetch(`/api/tasks/${taskId}`);
		if (!taskResponse.ok) throw new Error('Failed to fetch task data');

		const task = await taskResponse.json();
		const oldStatus = task.status;

		// Update the task status
		const updateData = { status: newStatus };
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updateData)
		});

		if (!response.ok) throw new Error('Failed to update task status');

		const updatedTask = await response.json();

		// If the task is assigned to a user, update their task status counts
		if (task.assignedTo) {
			await updateUserTaskStatus(task.assignedTo, oldStatus, newStatus, taskId);
		}

		return updatedTask;
	} catch (err) {
		console.error('Error updating task status:', err);
		throw err;
	}
}

/**
 * Bulk updates status for multiple tasks
 * @param taskIds Array of task IDs to update
 * @param newStatus New status for all tasks
 * @returns Promise that resolves when all tasks are updated
 */
export async function bulkUpdateTaskStatus(
	taskIds: string[],
	newStatus: Task['status']
): Promise<void> {
	try {
		// Process each task sequentially to ensure proper status tracking
		for (const taskId of taskIds) {
			await updateTaskStatus(taskId, newStatus);
		}
	} catch (err) {
		console.error('Error bulk updating task status:', err);
		throw err;
	}
}

/**
 * Updates the assignedTo field of a task and maintains user taskAssignments
 * @param taskId Task ID to update
 * @param userId User ID to assign to (empty string to unassign)
 * @returns Promise with the updated task
 */
export async function updateTaskAssignment(taskId: string, userId: string): Promise<Task> {
	try {
		// Get the current task to check for existing assignment
		const taskResponse = await fetch(`/api/tasks/${taskId}`);
		if (!taskResponse.ok) throw new Error('Failed to fetch task data');

		const task = await taskResponse.json();
		const oldAssignedTo = task.assignedTo;
		const currentStatus = task.status;

		// Update the task's assignedTo field
		const updateData = { assignedTo: userId };
		const response = await fetch(`/api/tasks/${taskId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(updateData)
		});

		if (!response.ok) throw new Error('Failed to update task assignment');

		const updatedTask = await response.json();

		// Handle changes to user task assignments

		// If previously assigned to someone else, remove from old user
		if (oldAssignedTo && oldAssignedTo !== userId) {
			await removeTaskFromUser(oldAssignedTo, taskId, currentStatus);
		}

		// If now assigned to someone new, add to new user
		if (userId) {
			await updateUserTaskAssignment(userId, taskId, currentStatus);
		}

		return updatedTask;
	} catch (err) {
		console.error('Error updating task assignment:', err);
		throw err;
	}
}

/**
 * Filters tasks based on selected tag IDs
 * @param tasks Array of tasks to filter
 * @param selectedTagIds Array of tag IDs to filter by
 * @param requireAllTags If true, tasks must have ALL selected tags. If false, tasks must have ANY of the selected tags.
 * @returns Filtered array of tasks
 */
export function filterTasksByTags(
	tasks: KanbanTask[],
	selectedTagIds: string[],
	requireAllTags: boolean = false
): KanbanTask[] {
	if (!selectedTagIds.length) {
		return tasks; // Return all tasks if no tags selected
	}

	return tasks.filter((task) => {
		const taskTags = task.tags || [];

		if (requireAllTags) {
			// Task must have ALL selected tags
			return selectedTagIds.every((tagId) => taskTags.includes(tagId));
		} else {
			// Task must have ANY of the selected tags
			return selectedTagIds.some((tagId) => taskTags.includes(tagId));
		}
	});
}

/**
 * Applies tag filtering to the kanban board columns
 * @param columns Columns array to update
 * @param allTasks All tasks (backup/source of truth)
 * @param selectedTagIds Array of tag IDs to filter by
 * @param requireAllTags If true, tasks must have ALL selected tags. If false, tasks must have ANY of the selected tags.
 * @param statusMapping Map of column titles to status values
 */
export function applyTagFilterToColumns(
	columns: KanbanColumn[],
	allTasks: KanbanTask[],
	selectedTagIds: string[],
	requireAllTags: boolean = false,
	statusMapping: Record<string, string>
): KanbanColumn[] {
	// If no tags selected, just return columns with all tasks
	if (!selectedTagIds.length) {
		return columns.map((col) => {
			const tasksForColumn = allTasks.filter((task) => {
				return col.status === statusMapping[task.status] || task.status === col.status;
			});

			return { ...col, tasks: tasksForColumn };
		});
	}

	// Filter tasks by tags
	const filteredTasks = filterTasksByTags(allTasks, selectedTagIds, requireAllTags);

	// Distribute filtered tasks to appropriate columns
	return columns.map((col) => {
		const tasksForColumn = filteredTasks.filter((task) => {
			return col.status === statusMapping[task.status] || task.status === col.status;
		});

		return { ...col, tasks: tasksForColumn };
	});
}
