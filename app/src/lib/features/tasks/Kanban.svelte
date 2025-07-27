<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { writable, get } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';
	import { slide, fly, fade } from 'svelte/transition';
	import { elasticOut, cubicIn, cubicOut, quintOut } from 'svelte/easing';
	import { currentUser } from '$lib/pocketbase';
	import { getAvatarUrl } from '../users/utils/avatarHandling';
	import { projectStore } from '$lib/stores/projectStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type {
		KanbanTask,
		KanbanAttachment,
		KanbanColumn,
		Task,
		Tag,
		User,
		InternalChatMessage,
		AIModel
	} from '$lib/types/types';
	import UserDisplay from '$lib/features/users/components/UserDisplay.svelte';
	import { t } from '$lib/stores/translationStore';
	import AssignButton from '$lib/components/buttons/AssignButton.svelte';
	import {
		updateTaskStatus,
		bulkUpdateTaskStatus,
		updateTaskAssignment,
		updateTask,
		filterTasksByTags,
		applyTagFilterToColumns
	} from '$lib/clients/taskClient';
	import TagsDropdown from '$lib/components/buttons/TagsDropdown.svelte';
	import TaskCalendar from '$lib/features/tasks/TaskCalendar.svelte';
	import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
	import { defaultModel } from '../ai/utils/models';
	import {
		sidenavStore,
		showSidenav,
		showInput,
		showRightSidenav,
		showFilters,
		showOverlay,
		showSettings
	} from '$lib/stores/sidenavStore';
	import { capitalizeFirst, processWordCrop, processWordMinimize } from '$lib/utils/textHandlers';
	import { clientTryCatch } from '$lib/utils/errorUtils';
	// import { createHoverManager } from '$lib/utils/hoverUtils';

	let currentProjectId: string | null = null;
	projectStore.subscribe((state) => {
		currentProjectId = state.currentProjectId;
	});
	let project = null;
	let isAuthenticated = false;
	let isAuthenticating = true;
	let isDeleteConfirmOpen = false;
	let taskToDelete: string | null = null;
	let showSubtasks = false;
	let taskTransition = false;
	let hoveredButton: 'all' | 'parents' | 'subtasks' | null = null;
	let showTagFilter = false;
	let selectedTagIds: string[] = [];
	let requireAllTags = false;
	let allColumnsOpen = true;
	let searchQuery = '';
	let hoveredButtonId: number | null = null;
	let priorityViewActive = false;
	let showAddTag = false;
	let addTagInput: HTMLInputElement;
	let userId: string = '';
	let threadId: string | null = null;
	let messageId: string | null = null;
	let initialMessage: InternalChatMessage | null = null;
	let localUsersCache = new Map<string, { name: string; avatar?: string; id: string }>();
	let pageCleanup: (() => void) | null = null;

	enum TaskViewMode {
		All = 'all',
		OnlySubtasks = 'subtasks',
		OnlyParentTasks = 'parents',
		LowPriority = 'low',
		mediumPriority = 'medium',
		highPriority = 'high'
	}
	let taskViewMode = TaskViewMode.All;
	let allTasksBackup: KanbanTask[] = [];
	let usersMap = new Map();
	let isLoadingUsers = false;

	// const pageHoverManager = createHoverManager({
	// 	hoverZone: 50,
	// 	minScreenWidth: 700,
	// 	debounceDelay: 100,
	// 	controls: ['sidenav'],
	// 	direction: 'left'
	// });

	// const {
	// 	hoverState: pageHoverState,
	// 	handleMenuLeave: handlePageMenuLeave,
	// 	toggleMenu: togglePageMenu
	// } = pageHoverManager;

	const userNameCache = new Map<string, string>();

	let aiModel = defaultModel;

	const statusMapping = {
		Backlog: 'backlog',
		'To Do': 'todo',
		'In Progress': 'inprogress',
		Review: 'review',
		Done: 'done',
		Hold: 'hold',
		Postponed: 'postpone',
		Delegate: 'delegate',
		Cancelled: 'cancel',
		Archived: 'archive'
	};

	const reverseStatusMapping = {
		backlog: ['Backlog'],
		todo: ['To Do'],
		inprogress: ['In Progress'],
		review: ['Review'],
		done: ['Done'],
		hold: ['Hold'],
		postpone: ['Postponed'],
		delegate: ['Delegate'],
		cancel: ['Cancelled'],
		archive: ['Archived']
	};

	let columns = writable<KanbanColumn[]>([
		{ id: 1, title: $t('tasks.backlog') as string, status: 'backlog', tasks: [], isOpen: true },
		{ id: 2, title: $t('tasks.todo') as string, status: 'todo', tasks: [], isOpen: true },
		{
			id: 3,
			title: $t('tasks.inprogress') as string,
			status: 'inprogress',
			tasks: [],
			isOpen: true
		},
		{ id: 4, title: $t('tasks.review') as string, status: 'review', tasks: [], isOpen: true },
		{ id: 5, title: $t('tasks.done') as string, status: 'done', tasks: [], isOpen: true },
		{ id: 6, title: $t('tasks.hold') as string, status: 'hold', tasks: [], isOpen: true },
		{ id: 7, title: $t('tasks.postponed') as string, status: 'postpone', tasks: [], isOpen: true },
		{ id: 8, title: $t('tasks.delegate') as string, status: 'delegate', tasks: [], isOpen: true },
		{ id: 9, title: $t('tasks.cancelled') as string, status: 'cancel', tasks: [], isOpen: true },
		{ id: 10, title: $t('tasks.archive') as string, status: 'archive', tasks: [], isOpen: true }
	]);

	let tags = writable<Tag[]>([]);
	let selectedTask: KanbanTask | null = null;
	let isModalOpen = false;
	let newTagName = '';
	let isEditingDescription = false;
	let isEditingTitle = false;
	let selectedDeadline: number | string | null = null;
	let selectedStart: number | string | null = null;
	let isLoading = writable(true);
	let error = writable<string | null>(null);
	let isEditingStartDate = false;
	let isEditingDueDate = false;
	let editingYear: number | null = null;
	let editingMonth: number | null = null;
	let editingDay: number | null = null;
	let editingDateType: 'start' | 'due' | null = null;

	/*
	 * projectStore.subscribe(state => {
	 *     if (state.currentProjectId) {
	 *         project = state.threads.find(p => p.id === state.currentProjectId);
	 *     } else {
	 *         project = null;
	 *     }
	 * });
	 */
	const unsubscribe = projectStore.subscribe((store) => {
		currentProjectId = store.currentProjectId;
		loadData(currentProjectId); // Reload data when project changes
	});

	function getRandomBrightColor(tagName: string): string {
		const hash = tagName.split('').reduce((acc, char) => {
			return char.charCodeAt(0) + ((acc << 5) - acc);
		}, 0);
		const h = hash % 360;
		return `hsl(${h}, 70%, 60%)`;
	}

	// Load data from PocketBase

	async function loadTasks(projectId: string | null) {
		try {
			let url = '/api/tasks';
			if (projectId) {
				url = `/api/projects/${projectId}/tasks`;
			}

			console.log('Loading tasks from:', url);

			const response = await fetch(url);
			console.log('Tasks response status:', response.status);
			console.log('Tasks response headers:', response.headers);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Tasks fetch failed:', response.status, errorText);
				throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
			}

			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				const responseText = await response.text();
				console.error('Tasks response is not JSON:', responseText);
				throw new Error('Invalid response format for tasks');
			}

			const data: { items: TaskResponse[] } = await response.json();
			console.log('Tasks data loaded:', data);

			// Define the response type we expect from the API
			interface TaskResponse {
				id: string;
				title: string;
				taskDescription?: string;
				created: string;
				due_date?: string;
				start_date?: string;
				taskTags?: string[];
				taggedTasks?: string;
				project_id?: string;
				createdBy?: string;
				assignedTo?: string;
				parent_task?: string;
				allocatedAgents?: string[];
				status: KanbanTask['status'];
				priority?: 'high' | 'medium' | 'low';
				prompt?: string;
				context?: string;
				task_outcome?: string;
				dependencies?: {
					type: 'subtask' | 'dependency' | 'resource' | 'precedence';
					task_id: string;
				}[];
				agentMessages?: string[];
			}

			// Reset all columns tasks
			columns.update((cols) => {
				return cols.map((col) => ({ ...col, tasks: [] }));
			});

			// Store all tasks for filtering purposes
			allTasksBackup = [];

			// Distribute tasks to appropriate columns
			columns.update((cols) => {
				data.items.forEach((task: TaskResponse) => {
					const taskObj: KanbanTask = {
						id: task.id,
						title: task.title,
						taskDescription: task.taskDescription || '',
						creationDate: new Date(task.created),
						due_date: task.due_date ? new Date(task.due_date) : null,
						start_date: task.start_date ? new Date(task.start_date) : null,
						tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
						attachments: [],
						project_id: task.project_id,
						createdBy: task.createdBy,
						assignedTo: task.assignedTo,
						parent_task: task.parent_task || undefined,
						allocatedAgents: task.allocatedAgents || [],
						status: task.status,
						priority: task.priority || 'medium',
						prompt: task.prompt || '',
						context: task.context || '',
						task_outcome: task.task_outcome || '',
						dependencies: task.dependencies || [],
						agentMessages: task.agentMessages || []
					};

					// Add to our backup of all tasks
					allTasksBackup.push(taskObj);

					// Find the appropriate column based on status
					const targetColumns = reverseStatusMapping[
						task.status as keyof typeof reverseStatusMapping
					] || ['Backlog'];
					const targetColumn = cols.find((col) => targetColumns.includes(col.title));

					if (targetColumn) {
						targetColumn.tasks.push(taskObj);
					} else {
						// If we can't find a matching column, default to Backlog
						const backlog = cols.find((col) => col.title === 'Backlog');
						if (backlog) backlog.tasks.push(taskObj);
					}
				});
				return cols;
			});

			// Initial application of task view filtering
			if (taskViewMode !== TaskViewMode.All) {
				applyTaskViewFilter();
			}

			console.log('Tasks loaded successfully');
		} catch (err) {
			console.error('Error loading tasks:', err);
			console.error('Error stack:', err instanceof Error ? err.stack : 'No stack');
			throw err;
		}
	}
	async function loadData(projectId: string | null) {
		isLoading.set(true);
		error.set(null);

		try {
			await loadTasks(projectId);
			await loadTags(projectId);

			isLoading.set(false);
		} catch (err) {
			console.error('Error loading data:', err);
			error.set(err instanceof Error ? err.message : 'Failed to load data');
			isLoading.set(false);
		}
	}
	async function loadTags(projectId: string | null) {
		try {
			// Always use the general tags endpoint, ignore projectId
			const url = '/api/tags';

			console.log('Loading tags from:', url);

			const response = await fetch(url);
			console.log('Tags response status:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Tags fetch failed:', response.status, errorText);

				// If the endpoint doesn't exist, return empty tags instead of failing
				if (response.status === 404) {
					console.log('Tags endpoint not found, returning empty tags');
					tags.set([]);
					return;
				}

				throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
			}

			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				const responseText = await response.text();
				console.error('Tags response is not JSON:', responseText);
				throw new Error('Invalid response format for tags');
			}

			const data = await response.json();
			console.log('Tags data loaded:', data);

			tags.set(data.items || []);
			console.log('Tags loaded successfully');
		} catch (err) {
			console.error('Error loading tags:', err);
			console.error('Error stack:', err instanceof Error ? err.stack : 'No stack');

			// Set empty tags so the component doesn't break
			tags.set([]);
			throw err;
		}
	}

	async function saveTag(tag: Tag) {
		try {
			type TagPayload = {
				name: string;
				color: string;
				thread_id?: string[];
				user?: string;
				tagDescription?: string;
				createdBy?: string;
				selected?: boolean;
				taggedProjects?: string;
			};

			const payload: TagPayload = {
				name: tag.name,
				color: tag.color,
				thread_id: tag.thread_id,
				user: tag.user,
				tagDescription: tag.tagDescription || '',
				createdBy: get(currentUser)?.id,
				selected: tag.selected || false
			};

			if (currentProjectId) {
				payload.taggedProjects = currentProjectId;
			}

			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) throw new Error('Failed to save tag');

			const savedTag = await response.json();
			tags.update((currentTags) => {
				const filtered = currentTags.filter((t) => t.id !== tag.id);
				return [...filtered, savedTag];
			});

			return savedTag;
		} catch (err) {
			console.error('Error saving tag:', err);
			throw err;
		}
	}
	async function updateTaskTags(taskId: string, tagIds: string[], taskDescription?: string) {
		try {
			console.log(`Updating tags for task ${taskId} with:`, tagIds);

			// Prepare the update data
			const updateData: Partial<Task> & { taggedTasks: string } = {
				taggedTasks: tagIds.join(','),
				taskTags: tagIds
			};

			// If taskDescription is provided, update it as well
			if (taskDescription !== undefined) {
				updateData.taskDescription = taskDescription;
			}

			console.log('Update data:', updateData);

			// Update the task directly
			const updateResponse = await fetch(`/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			if (!updateResponse.ok) {
				const errorText = await updateResponse.text();
				console.error(`Server error (${updateResponse.status}):`, errorText);
				throw new Error(
					`Failed to update task tags: ${updateResponse.status} ${updateResponse.statusText}`
				);
			}

			return await updateResponse.json();
		} catch (err) {
			console.error('Error updating task tags:', err);
			throw err;
		}
	}

	async function saveTask(task: KanbanTask) {
		try {
			const attachmentPromises = task.attachments
				.filter((att): att is KanbanAttachment & { file: File } => !!att.file)
				.map(async (att) => {
					const formData = new FormData();
					formData.append('file', att.file);
					formData.append('fileName', att.fileName);
					if (att.note) formData.append('note', att.note);
					formData.append('createdBy', get(currentUser)?.id ?? '');

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
					} as const;
				});

			const savedAttachments = await Promise.all(attachmentPromises);

			const updatedAttachments = task.attachments.map((att) => {
				if (att.file) {
					const savedAtt = savedAttachments.find((sa) => sa.fileName === att.fileName);
					return savedAtt || att;
				}
				return att;
			});

			/*
			 * Use the task's current status directly instead of trying to determine it from columns
			 * This fixes the issue where status gets overridden during drag operations
			 */
			const taskStatus = task.status;

			// Prepare attachment IDs as a comma-separated string
			const attachmentIds = updatedAttachments.map((att) => att.id).join(',');

			const taskData = {
				title: task.title,
				taskDescription: task.taskDescription,
				project_id: currentProjectId || '',
				createdBy: get(currentUser)?.id || '',
				assignedTo: task.assignedTo || '',
				parent_task: task.parent_task || '',
				status: taskStatus,
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
				agentMessages: task.agentMessages || []
			};

			let url = '/api/tasks';
			let method: 'POST' | 'PATCH' = 'POST';

			// If task has an ID that's not auto-generated locally, it's an update
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

			// Update the task in the columns
			columns.update((cols) => {
				return cols.map((col) => ({
					...col,
					tasks: col.tasks.map((t) =>
						t.id === task.id
							? {
									...savedTask,
									id: savedTask.id,
									attachments: updatedAttachments,
									creationDate: new Date(savedTask.created),
									due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
									start_date: savedTask.start_date ? new Date(savedTask.start_date) : null,
									tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : [],
									status: savedTask.status // Make sure status is updated from the server response
								}
							: t
					)
				}));
			});

			return savedTask;
		} catch (err) {
			console.error('Error saving task:', err);
			throw err;
		}
	}

	function openDeleteConfirm(taskId: string, event: MouseEvent) {
		event.stopPropagation();
		taskToDelete = taskId;
		isDeleteConfirmOpen = true;
	}

	function confirmDelete() {
		if (taskToDelete) {
			// If the task to delete is currently open in the modal, close it first
			if (selectedTask && selectedTask.id === taskToDelete) {
				isModalOpen = false;
				selectedTask = null;
			}

			// Then delete the task
			deleteTask(taskToDelete)
				.then(() => {
					isDeleteConfirmOpen = false;
					taskToDelete = null;
				})
				.catch((err) => {
					error.set(`Failed to delete task: ${err.message}`);
					isDeleteConfirmOpen = false;
					taskToDelete = null;
				});
		}
	}

	function cancelDelete() {
		isDeleteConfirmOpen = false;
		taskToDelete = null;
	}
	function applyTaskViewFilter() {
		columns.update((cols) => {
			return cols.map((col) => {
				const tasksForColumn = allTasksBackup.filter((task) => {
					const belongsInColumn = col.status === task.status;

					if (!belongsInColumn) return false;

					switch (taskViewMode) {
						case TaskViewMode.All:
							return true;
						case TaskViewMode.OnlySubtasks:
							return !!task.parent_task;
						case TaskViewMode.OnlyParentTasks:
							return allTasksBackup.some((t) => t.parent_task === task.id);
						case TaskViewMode.LowPriority:
							return task.priority === 'low';
						case TaskViewMode.mediumPriority:
							return task.priority === 'medium';
						case TaskViewMode.highPriority:
							return task.priority === 'high';
						default:
							return true;
					}
				});

				return { ...col, tasks: tasksForColumn };
			});
		});
	}

	function applyFilters() {
		if (searchQuery.trim()) {
			searchTasks(searchQuery);
		} else {
			columns.update((cols) => {
				let tasksToFilter = [...allTasksBackup];

				if (selectedTagIds.length > 0) {
					tasksToFilter = filterTasksByTags(tasksToFilter, selectedTagIds, requireAllTags);
				}

				return cols.map((col) => {
					const tasksForColumn = tasksToFilter.filter((task) => {
						const belongsInColumn = col.status === task.status;

						if (!belongsInColumn) return false;

						switch (taskViewMode) {
							case TaskViewMode.All:
								return true;
							case TaskViewMode.OnlySubtasks:
								return !!task.parent_task;
							case TaskViewMode.OnlyParentTasks:
								return allTasksBackup.some((t) => t.parent_task === task.id);
							default:
								return true;
						}
					});

					return { ...col, tasks: tasksForColumn };
				});
			});
		}
	}
	function toggleTaskView(mode: TaskViewMode) {
		taskViewMode = mode;
		applyTaskViewFilter();
	}

	function handleTagsChanged(event: CustomEvent) {
		selectedTagIds = event.detail.selectedTags;
		applyFilters();
	}

	function toggleRequireAllTags() {
		requireAllTags = !requireAllTags;
		applyFilters();
	}

	function toggleTagFilter() {
		showTagFilter = !showTagFilter;
		if (!showTagFilter) {
			selectedTagIds = [];
			applyFilters();
		}
	}
	async function deleteTask(taskId: string) {
		try {
			if (taskId.startsWith('local_')) {
				columns.update((cols) => {
					return cols.map((col) => ({
						...col,
						tasks: col.tasks.filter((t) => t.id !== taskId)
					}));
				});
				return;
			}

			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete task');

			columns.update((cols) => {
				return cols.map((col) => ({
					...col,
					tasks: col.tasks.filter((t) => t.id !== taskId)
				}));
			});
		} catch (err) {
			console.error('Error deleting task:', err);
			throw err;
		}
	}

	function deepCopy<T>(obj: T): T {
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}

		if (obj instanceof Date) {
			return new Date(obj.getTime()) as T;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => deepCopy(item)) as T;
		}

		if (obj instanceof Object) {
			const copy = {} as T;
			Object.keys(obj).forEach((key) => {
				copy[key as keyof T] = deepCopy(obj[key as keyof T]);
			});
			return copy;
		}

		throw new Error(`Unable to copy obj! Its type isn't supported.`);
	}

	function moveTask(taskId: string, fromColumnId: number, toColumnId: number) {
		columns.update((cols) => {
			const fromColumn = cols.find((col) => col.id === fromColumnId);
			const toColumn = cols.find((col) => col.id === toColumnId);

			if (fromColumn && toColumn) {
				const taskIndex = fromColumn.tasks.findIndex((task) => task.id === taskId);

				if (taskIndex !== -1) {
					const task = deepCopy(fromColumn.tasks[taskIndex]);

					// First move the task in the UI for immediate feedback
					fromColumn.tasks.splice(taskIndex, 1);

					// Define statusMapping with proper typing
					const statusMapping: Record<string, KanbanTask['status']> = {
						Backlog: 'backlog',
						'To Do': 'todo',
						'In Progress': 'inprogress',
						Review: 'review',
						Done: 'done',
						Hold: 'hold',
						Postponed: 'postpone',
						Delegate: 'delegate',
						Cancelled: 'cancel',
						Archived: 'archive'
					};

					// Get the correct new status with type safety
					let newStatus: KanbanTask['status'];
					const columnTitle = toColumn.title as keyof typeof statusMapping;

					if (columnTitle in statusMapping) {
						newStatus = statusMapping[columnTitle];
					} else {
						// Handle case where column title doesn't map directly to a status
						newStatus = toColumn.status;
					}

					console.log(
						`Moving task from ${fromColumn.title} to ${toColumn.title} - new status: ${newStatus}`
					);

					// Ensure newStatus is a valid status value
					const validStatuses: KanbanTask['status'][] = [
						'backlog',
						'todo',
						'inprogress',
						'done',
						'hold',
						'postpone',
						'cancel',
						'review',
						'delegate',
						'archive'
					];

					if (!validStatuses.includes(newStatus)) {
						console.error(
							`Invalid status: ${newStatus}, falling back to column status: ${toColumn.status}`
						);
						newStatus = toColumn.status;
					}

					task.status = newStatus;

					if (!task.tags) {
						task.tags = [];
					}

					toColumn.tasks.push(task);

					// Use simple updateTask instead of updateTaskStatus to avoid user assignment issues
					(async () => {
						try {
							// Simple status update without user assignment logic
							await updateTask(taskId, { status: task.status });
						} catch (err) {
							console.error('Error updating task status:', err);
							error.set(err instanceof Error ? err.message : 'Failed to move tasks');

							// Revert the UI changes
							fromColumn.tasks.splice(taskIndex, 0, task);
							const revertIndex = toColumn.tasks.findIndex((t) => t.id === taskId);
							if (revertIndex !== -1) {
								toColumn.tasks.splice(revertIndex, 1);
							}

							// Trigger UI update
							columns.update((c) => c);
						}
					})();
				}
			}
			return cols;
		});
	}
	function toggleColumn(columnId: number) {
		columns.update((cols) => {
			const column = cols.find((col) => col.id === columnId);
			if (column) {
				column.isOpen = !column.isOpen;
			}
			return cols;
		});
	}
	function toggleAllColumns() {
		// Update the state
		allColumnsOpen = !allColumnsOpen;

		columns.update((cols) => {
			return cols.map((col) => ({
				...col,
				isOpen: allColumnsOpen
			}));
		});
	}
	function handleDragStart(event: DragEvent, taskId: string, fromColumnId: number) {
		if (event.dataTransfer) {
			event.dataTransfer.setData('text/plain', JSON.stringify({ taskId, fromColumnId }));
			event.dataTransfer.effectAllowed = 'move';

			(event.target as HTMLElement).classList.add('dragging');

			setTimeout(() => {
				document.querySelectorAll('.toggle-btn').forEach((btn) => {
					btn.classList.add('drop-enabled');
				});
			}, 0);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent, toColumnId: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			const data = JSON.parse(event.dataTransfer.getData('text/plain'));
			moveTask(data.taskId, data.fromColumnId, toColumnId);
		}
	}

	function handleDragEnd(event: DragEvent) {
		(event.target as HTMLElement).classList.remove('dragging');

		document.querySelectorAll('.toggle-btn').forEach((btn) => {
			btn.classList.remove('drop-enabled', 'drag-hover');
		});
		hoveredButtonId = null;
	}

	function handleButtonDragOver(event: DragEvent, columnId: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}

		const button = event.currentTarget as HTMLElement;
		button.classList.add('drag-hover');
		hoveredButtonId = columnId;
	}

	function handleButtonDragLeave(event: DragEvent) {
		const button = event.currentTarget as HTMLElement;
		button.classList.remove('drag-hover');

		if (button.contains(event.relatedTarget as Node) === false) {
			hoveredButtonId = null;
		}
	}

	function handleButtonDrop(event: DragEvent, toColumnId: number) {
		event.preventDefault();
		event.stopPropagation();

		const button = event.currentTarget as HTMLElement;
		button.classList.remove('drag-hover');

		if (event.dataTransfer) {
			const data = JSON.parse(event.dataTransfer.getData('text/plain'));

			if (data.fromColumnId !== toColumnId) {
				moveTask(data.taskId, data.fromColumnId, toColumnId);
			}
		}

		document.querySelectorAll('.toggle-btn').forEach((btn) => {
			btn.classList.remove('drop-enabled', 'drag-hover');
		});
		hoveredButtonId = null;
	}
	function openModal(task: KanbanTask, event: MouseEvent) {
		event.stopPropagation();
		selectedTask = deepCopy(task);
		isModalOpen = true;
		isEditingTitle = false;
		isEditingDescription = false;
		selectedDeadline = null;
		selectedStart = null;
	}

	function saveAndCloseModal(task?: KanbanTask) {
		if (selectedTask) {
			const taskToSave = { ...selectedTask };

			let taskExists = false;
			columns.update((cols) => {
				for (const col of cols) {
					if (col.tasks.some((t) => t.id === taskToSave.id)) {
						taskExists = true;
						break;
					}
				}
				return cols;
			});

			if (!taskExists) {
				selectedTask = null;
				isModalOpen = false;
				return;
			}
			const taskForUpdate = {
				...taskToSave,
				due_date: taskToSave.due_date || undefined,
				start_date: taskToSave.start_date || undefined,
				attachments: JSON.stringify(taskToSave.attachments)
			};

			updateTask(taskToSave.id, taskForUpdate)
				.then(() => {
					columns.update((cols) => {
						return cols.map((col) => ({
							...col,
							tasks: col.tasks.map((task) => (task.id === taskToSave.id ? { ...taskToSave } : task))
						}));
					});
					selectedTask = null;
					isModalOpen = false;
				})
				.catch((err) => {
					error.set(`Failed to save task: ${err.message}`);
				});
		} else {
			isModalOpen = false;
		}
	}
	function toggleAddTag() {
		showAddTag = !showAddTag;
		if (showAddTag) {
			// Focus the input when it becomes visible
			setTimeout(() => addTagInput?.focus(), 0);
		}
	}

	function handleInputBlur() {
		showAddTag = false;
	}

	async function addTag() {
		if (newTagName.trim()) {
			const currentUserId = get(currentUser)?.id;

			// Handle case where user is not available
			if (!currentUserId) {
				error.set('User not authenticated');
				return;
			}

			const tagColor = getRandomBrightColor(newTagName.trim());
			const newTag: Partial<Tag> = {
				id: `local_tag_${Date.now()}`,
				name: newTagName.trim(),
				tagDescription: '',
				color: tagColor,
				createdBy: currentUserId,
				selected: false
			};

			tags.update((t) => [...t, newTag as Tag]);
			newTagName = '';

			try {
				await saveTag(newTag as Tag);
				showAddTag = false;
			} catch (err) {
				error.set(err instanceof Error ? err.message : 'Failed to save tag');
			}
		}
	}
	function addGlobalTask(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			const input = event.target as HTMLTextAreaElement;
			const title = input.value.trim();

			if (title) {
				// Find the Backlog column (should be the first one with id=1)
				columns.update((cols) => {
					const backlogColumn = cols.find((col) => col.title === 'Backlog');

					if (backlogColumn) {
						const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
						const newTask: KanbanTask = {
							id: localId,
							title,
							taskDescription: '',
							creationDate: new Date(),
							due_date: null,
							start_date: null,
							tags: [],
							attachments: [],
							project_id: currentProjectId || undefined,
							createdBy: get(currentUser)?.id,
							allocatedAgents: [],
							status: 'backlog',
							priority: 'medium'
						};

						backlogColumn.tasks.push(newTask);

						saveTask(newTask)
							.then((savedTask) => {
								columns.update((cols) => {
									return cols.map((col) => ({
										...col,
										tasks: col.tasks.map((t) =>
											t.id === localId
												? {
														...savedTask,
														id: savedTask.id,
														creationDate: new Date(savedTask.created),
														due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
														start_date: savedTask.start_date
															? new Date(savedTask.start_date)
															: null,
														tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : []
													}
												: t
										)
									}));
								});
							})
							.catch((err) => {
								error.set(`Failed to save task: ${err.message}`);
							});
					}

					return cols;
				});

				// Clear the input field
				input.value = '';
			}
		}
	}
	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && selectedTask) {
			for (let i = 0; i < input.files.length; i++) {
				const file = input.files[i];
				const attachment: KanbanAttachment = {
					id: `local_attachment_${Date.now()}_${i}`,
					fileName: file.name,
					url: URL.createObjectURL(file),
					file: file
				};
				selectedTask.attachments = [...selectedTask.attachments, attachment];
			}
			selectedTask = { ...selectedTask }; // Trigger reactivity
		}
	}

	function setQuickDeadline(days: number) {
		if (selectedTask) {
			const deadline = new Date();
			deadline.setDate(deadline.getDate() + days);
			selectedTask.due_date = deadline;
			selectedTask = { ...selectedTask };
			selectedDeadline = days;
		}
	}

	function setEndOfWeekDeadline() {
		if (selectedTask) {
			const deadline = new Date();
			const daysUntilEndOfWeek = 7 - deadline.getDay();
			deadline.setDate(deadline.getDate() + daysUntilEndOfWeek);
			selectedTask.due_date = deadline;
			selectedTask = { ...selectedTask };
			selectedDeadline = 'endOfWeek';
		}
	}
	function setQuickStart(days: number) {
		if (selectedTask) {
			const start = new Date();
			start.setDate(start.getDate() + days);
			selectedTask.start_date = start;
			selectedTask = { ...selectedTask };
			selectedStart = days;
		}
	}

	function setEndOfWeekStart() {
		if (selectedTask) {
			const start = new Date();
			const daysUntilEndOfWeek = 7 - start.getDay();
			start.setDate(start.getDate() + daysUntilEndOfWeek);
			selectedTask.start_date = start;
			selectedTask = { ...selectedTask };
			selectedStart = 'endOfWeek';
		}
	}

	function toggleTag(tagId: string) {
		if (selectedTask) {
			const tagIndex = selectedTask.tags.indexOf(tagId);
			if (tagIndex === -1) {
				selectedTask.tags = [...selectedTask.tags, tagId];
			} else {
				selectedTask.tags = selectedTask.tags.filter((id) => id !== tagId);
			}
			selectedTask = { ...selectedTask }; // Trigger reactivity

			// If task is already saved to PocketBase, update the tags relation
			if (selectedTask.id && !selectedTask.id.startsWith('local_')) {
				console.log(`Toggling tag ${tagId} on task ${selectedTask.id}`);
				updateTaskTags(selectedTask.id, selectedTask.tags, selectedTask.taskDescription)
					.then((updatedTask) => {
						console.log('Tags updated successfully:', updatedTask);
					})
					.catch((err) => {
						console.error('Failed to update tags:', err);
						error.set(`Failed to update task tags: ${err.message}`);
					});
			}
		}
	}

	function toggleAgent(agentId: string) {
		if (selectedTask) {
			const agentIndex = selectedTask.allocatedAgents.indexOf(agentId);
			if (agentIndex === -1) {
				selectedTask.allocatedAgents = [...selectedTask.allocatedAgents, agentId];
			} else {
				selectedTask.allocatedAgents = selectedTask.allocatedAgents.filter((id) => id !== agentId);
			}
			selectedTask = { ...selectedTask }; // Trigger reactivity
		}
	}
	// Update these helper functions to check allTasksBackup instead of just visible tasks
	function hasSubtasks(taskId: string): boolean {
		if (!taskId) return false;

		// Check in the complete tasks backup, not just currently visible tasks
		return allTasksBackup.some((task) => task.parent_task === taskId);
	}

	function countSubtasks(taskId: string): number {
		if (!taskId) return 0;

		// Count in the complete tasks backup
		return allTasksBackup.filter((task) => task.parent_task === taskId).length;
	}

	function getSubtasks(taskId: string): KanbanTask[] {
		if (!taskId) return [];

		// Get from the complete tasks backup
		return allTasksBackup.filter((task) => task.parent_task === taskId);
	}

	// Reactive statement to maintain a map of parent task titles
	$: parentTaskNames = (() => {
		const map = new Map<string, string>();
		allTasksBackup.forEach((task) => {
			map.set(task.id, task.title);
		});
		return map;
	})();

	async function getParentTaskTitle(parentId: string | undefined): Promise<string> {
		if (!parentId) return 'Unknown';

		// Check local cache first
		if (parentTaskNames.has(parentId)) {
			return parentTaskNames.get(parentId) || 'Unknown';
		}

		// If not in cache, fetch from API
		try {
			const response = await fetch(`/api/tasks/${parentId}`);
			if (!response.ok) throw new Error('Failed to fetch parent task');

			const parentTask = await response.json();
			const title = parentTask.title || 'Unknown';

			// Update cache
			parentTaskNames.set(parentId, title);

			return title;
		} catch (err: unknown) {
			console.error('Error fetching parent task:', err);
			return 'Unknown';
		}
	}
	function navigateToParentTask(parentId: string, event: MouseEvent) {
		if (!parentId) return;

		event.stopPropagation();

		// Find the parent task
		let parentTask: KanbanTask | null = null;
		$columns.forEach((col) => {
			col.tasks.forEach((task) => {
				if (task.id === parentId) {
					parentTask = task;
				}
			});
		});

		if (parentTask) {
			// Add a visual transition effect
			taskTransition = true;

			// Update the task with a small delay for visual feedback
			setTimeout(() => {
				selectedTask = deepCopy(parentTask);
				isEditingTitle = false;
				isEditingDescription = false;
				showSubtasks = false;
				selectedDeadline = null;

				// Reset the transition flag after a moment
				setTimeout(() => {
					taskTransition = false;
				}, 300);
			}, 50);
		}
	}

	async function handleTaskAssigned(detail: { taskId: string; userId: string }) {
		const { taskId, userId } = detail;

		const result = await clientTryCatch(
			(async () => {
				if (selectedTask && selectedTask.id === taskId) {
					selectedTask.assignedTo = userId;
					selectedTask = { ...selectedTask };
				}

				await updateTaskAssignment(taskId, userId);

				columns.update((cols) => {
					return cols.map((col) => ({
						...col,
						tasks: col.tasks.map((task) =>
							task.id === taskId ? { ...task, assignedTo: userId } : task
						)
					}));
				});
			})(),
			'Failed to handle task assignment'
		);

		if (!result.success) {
			console.error('Error handling task assignment:', result.error);
		}
	}

	async function handleTaskUnassigned(taskId: string) {
		const result = await clientTryCatch(
			(async () => {
				if (selectedTask && selectedTask.id === taskId) {
					selectedTask.assignedTo = '';
					selectedTask = { ...selectedTask };
				}

				await updateTaskAssignment(taskId, '');

				// Update in columns
				columns.update((cols) => {
					return cols.map((col) => ({
						...col,
						tasks: col.tasks.map((task) =>
							task.id === taskId ? { ...task, assignedTo: '' } : task
						)
					}));
				});
			})(),
			'Failed to handle task unassignment'
		);

		if (!result.success) {
			console.error('Error handling task unassignment:', result.error);
		}
	}

	function searchTasks(query: string) {
		if (!query.trim()) {
			// If search is empty, restore original tasks
			applyFilters();
			return;
		}

		// Normalize the search query (lowercase)
		const normalizedQuery = query.toLowerCase().trim();

		columns.update((cols) => {
			return cols.map((col) => {
				// Start with tasks that would be shown based on other active filters
				let filteredTasks = [...allTasksBackup];

				// Apply tag filters if active
				if (selectedTagIds.length > 0) {
					filteredTasks = filterTasksByTags(filteredTasks, selectedTagIds, requireAllTags);
				}

				// Apply task view mode filters
				switch (taskViewMode) {
					case TaskViewMode.OnlySubtasks:
						filteredTasks = filteredTasks.filter((task) => !!task.parent_task);
						break;
					case TaskViewMode.OnlyParentTasks:
						filteredTasks = filteredTasks.filter((task) =>
							allTasksBackup.some((t) => t.parent_task === task.id)
						);
						break;
				}

				// Apply search query - search in title, description, and tags
				filteredTasks = filteredTasks.filter((task) => {
					// Check if task belongs to this column
					const belongsInColumn = col.status === task.status;

					if (!belongsInColumn) return false;

					// Search in title
					if (task.title.toLowerCase().includes(normalizedQuery)) return true;

					// Search in description
					if (task.taskDescription?.toLowerCase().includes(normalizedQuery)) return true;

					// Search in tags
					const taskTags = $tags.filter((tag) => task.tags.includes(tag.id));
					if (taskTags.some((tag) => tag.name.toLowerCase().includes(normalizedQuery))) return true;

					// Search by priority
					if (task.priority.toLowerCase().includes(normalizedQuery)) return true;

					// Search by creator or assignee name (async, but works for pre-loaded names)
					if (
						task.createdBy &&
						userNameCache.has(task.createdBy) &&
						userNameCache.get(task.createdBy)?.toLowerCase().includes(normalizedQuery)
					)
						return true;

					if (
						task.assignedTo &&
						userNameCache.has(task.assignedTo) &&
						userNameCache.get(task.assignedTo)?.toLowerCase().includes(normalizedQuery)
					)
						return true;
					return false;
				});

				return { ...col, tasks: filteredTasks };
			});
		});
	}
	async function togglePriority(task: KanbanTask, event: MouseEvent) {
		event.stopPropagation();

		const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
		const currentIndex = priorities.indexOf(task.priority);
		const nextIndex = (currentIndex + 1) % priorities.length;
		const newPriority = priorities[nextIndex];

		columns.update((cols) => {
			return cols.map((col) => ({
				...col,
				tasks: col.tasks.map((t) => (t.id === task.id ? { ...t, priority: newPriority } : t))
			}));
		});

		allTasksBackup = allTasksBackup.map((t) =>
			t.id === task.id ? { ...t, priority: newPriority } : t
		);

		if (selectedTask && selectedTask.id === task.id) {
			selectedTask = { ...selectedTask, priority: newPriority };
		}

		// Update in the backend
		try {
			// Fix: Create a proper Task object for updateTask, only include Task-compatible fields
			const taskUpdate: Partial<Task> = {
				id: task.id,
				title: task.title,
				priority: newPriority,
				status: task.status,
				due_date: task.due_date || undefined,
				start_date: task.start_date || undefined,
				taskDescription: task.taskDescription,
				project_id: task.project_id,
				createdBy: task.createdBy,
				parent_task: task.parent_task,
				assignedTo: task.assignedTo,
				attachments: Array.isArray(task.attachments)
					? JSON.stringify(task.attachments)
					: task.attachments,
				prompt: task.prompt,
				context: task.context,
				task_outcome: task.task_outcome,
				dependencies: task.dependencies,
				agentMessages: task.agentMessages,
				allocatedAgents: task.allocatedAgents,
				taskTags: task.tags
			};

			await updateTask(task.id, taskUpdate);
		} catch (err) {
			console.error('Error updating task priority:', err);
			// Revert back if the update fails
			columns.update((cols) => {
				return cols.map((col) => ({
					...col,
					tasks: col.tasks.map((t) => (t.id === task.id ? { ...t, priority: task.priority } : t))
				}));
			});

			// Also revert the backup
			allTasksBackup = allTasksBackup.map((t) =>
				t.id === task.id ? { ...t, priority: task.priority } : t
			);

			if (selectedTask && selectedTask.id === task.id) {
				selectedTask = { ...selectedTask, priority: task.priority };
			}
		}
	}
	function applyPriorityFilter() {
		columns.update((cols) => {
			if (!cols) return cols;

			if (priorityViewActive) {
				return cols.map((col) => ({
					...col,
					tasks: col.tasks.filter((task) => task.priority === 'high')
				}));
			} else {
				// Reset from backup
				return getColumnTasksFromBackup();
			}
		});
	}
	function getColumnTasksFromBackup() {
		return get(columns).map((col) => ({
			...col,
			tasks: allTasksBackup.filter((task) => {
				const targetColumns = reverseStatusMapping[task.status] || ['Backlog'];
				return targetColumns.includes(col.title);
			})
		}));
	}
	function togglePriorityView(event: MouseEvent) {
		event.stopPropagation();

		// Ensure all columns are open when applying priority filters
		if (taskViewMode === TaskViewMode.All) {
			if (!allColumnsOpen) {
				toggleAllColumns();
			}
		}

		switch (taskViewMode) {
			case TaskViewMode.highPriority:
				toggleTaskView(TaskViewMode.mediumPriority);
				break;
			case TaskViewMode.mediumPriority:
				toggleTaskView(TaskViewMode.LowPriority);
				break;
			case TaskViewMode.LowPriority:
				toggleTaskView(TaskViewMode.All);
				break;
			default:
				toggleTaskView(TaskViewMode.highPriority);
		}
	}

	// Get all tags for a specific task, with selected tags first
	function getOrderedTaskTags(task: KanbanTask, allTags: Tag[]): Tag[] {
		if (!task.tags || task.tags.length === 0) {
			// If no tags are selected, return all tags
			return allTags;
		}

		// Get tags that are selected for this task
		const selectedTags = allTags.filter((tag) => task.tags.includes(tag.id));

		// Get tags that are not selected for this task
		const unselectedTags = allTags.filter((tag) => !task.tags.includes(tag.id));

		// Return selected tags first, then unselected tags
		return [...selectedTags, ...unselectedTags];
	}
	/**
	 * Handles date scrolling with threshold and sensitivity controls
	 * @param event The wheel event
	 * @param date The date to modify
	 * @param part Which part of the date to modify ('day', 'month', 'year')
	 * @param task The task object that will be updated
	 * @param dateType Whether this is 'start_date' or 'due_date'
	 */

	function handleDateScroll(
		event: WheelEvent,
		date: Date | null,
		part: 'day' | 'month' | 'year',
		task: KanbanTask,
		dateType: 'start_date' | 'due_date'
	): void {
		if (!date) return;
		event.preventDefault();
		event.stopPropagation();

		// Store scroll accumulation in a closure to track between events
		if (!task._scrollAccumulation) {
			task._scrollAccumulation = { day: 0, month: 0, year: 0 };
		}

		// Different sensitivity levels based on part
		let sensitivity = 1;
		switch (part) {
			case 'day':
				sensitivity = event.shiftKey ? 0.01 : 0.1;
				break;
			case 'month':
				sensitivity = event.shiftKey ? 0.01 : 0.1;
				break;
			case 'year':
				sensitivity = event.shiftKey ? 0.01 : 0.1;
				break;
		}

		// Calculate delta and add to accumulated value
		const delta = event.deltaY > 0 ? -1 : 1;
		task._scrollAccumulation[part] += delta * sensitivity;

		// Check if we've crossed the threshold to actually change the date
		if (Math.abs(task._scrollAccumulation[part]) >= 1) {
			// Round to the nearest integer and get its sign
			const change = Math.sign(task._scrollAccumulation[part]);

			// Apply the change to the date
			const newDate = new Date(date);
			switch (part) {
				case 'day':
					newDate.setDate(newDate.getDate() + change);
					break;
				case 'month':
					newDate.setMonth(newDate.getMonth() + change);
					break;
				case 'year':
					newDate.setFullYear(newDate.getFullYear() + change);
					break;
			}

			// Reset the accumulation to the remainder after applying
			task._scrollAccumulation[part] %= 1;

			// Update the task with the new date
			if (dateType === 'start_date') {
				task.start_date = newDate;
			} else {
				task.due_date = newDate;
			}

			// Update task in the UI and backend
			columns.update((cols) => {
				return cols.map((col) => ({
					...col,
					tasks: col.tasks.map((t) => (t.id === task.id ? { ...t, [dateType]: newDate } : t))
				}));
			});

			if (task._updateTimeout) {
				clearTimeout(task._updateTimeout);
			}

			task._updateTimeout = setTimeout(() => {
				const updateData: Partial<Task> = {
					...task,
					attachments: JSON.stringify(task.attachments),
					due_date: task.due_date ? task.due_date.toISOString() : undefined,
					start_date: task.start_date ? task.start_date.toISOString() : undefined,
					_scrollAccumulation: undefined,
					_updateTimeout: undefined
				};

				updateTask(task.id, updateData);
				delete task._updateTimeout;
			}, 500) as unknown as number;
		}
	}
	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.style.display = 'none';
	}
	function handleAvatarError(event: Event) {
		const target = event.target as HTMLImageElement;
		if (target) {
			target.style.display = 'none';
		}
	}

	function updateBackup(taskId: string, newTags: string[]) {
		allTasksBackup = allTasksBackup.map((task) =>
			task.id === taskId ? { ...task, tags: newTags } : task
		);
	}

	function handleTagClick(event: MouseEvent, task: KanbanTask, tag: Tag) {
		event.stopPropagation();

		const newTags = task.tags.includes(tag.id)
			? task.tags.filter((id) => id !== tag.id)
			: [...task.tags, tag.id];

		// Update columns
		columns.update((cols) => {
			return cols.map((col) => ({
				...col,
				tasks: col.tasks.map((t) => (t.id === task.id ? { ...t, tags: newTags } : t))
			}));
		});

		// Update backup
		updateBackup(task.id, newTags);

		// Update backend
		updateTaskTags(task.id, newTags);
	}

	function populateUserCacheFromTasks() {
		// This assumes your tasks already have user information embedded
		// If they don't, we'll just use current user info
		const currentUserId = $currentUser?.id;
		const currentUserData = $currentUser;

		if (currentUserId && currentUserData) {
			localUsersCache.set(currentUserId, {
				id: currentUserData.id,
				name: currentUserData.name || currentUserData.username || currentUserData.email || 'You',
				avatar: currentUserData.avatar
			});
		}

		// For other users, create placeholder entries
		const allUserIds = [
			...new Set([
				...allTasksBackup.map((task) => task.createdBy).filter(Boolean),
				...allTasksBackup.map((task) => task.assignedTo).filter(Boolean)
			])
		];

		allUserIds.forEach((userId) => {
			if (userId && !localUsersCache.has(userId) && userId !== currentUserId) {
				// Create placeholder - no API call
				localUsersCache.set(userId, {
					id: userId,
					name: 'User',
					avatar: undefined
				});
			}
		});

		// Trigger reactivity
		localUsersCache = localUsersCache;
	}

	// Helper functions - NO API CALLS
	function getUser(userId: string): { name: string; avatar?: string; id: string } | null {
		if (!userId) return null;

		// Check current user first
		if ($currentUser?.id === userId) {
			return {
				id: $currentUser.id,
				name: $currentUser.name || $currentUser.username || $currentUser.email || 'You',
				avatar: $currentUser.avatar
			};
		}

		// Check local cache
		return localUsersCache.get(userId) || null;
	}

	function getUserDisplayName(userId: string): string {
		const user = getUser(userId);
		if (!user) return 'Unknown';

		return user.name;
	}

	function getUserAvatar(userId: string): string {
		const user = getUser(userId);
		if (!user || !user.avatar) return '';

		// Use the avatar URL utility
		return getAvatarUrl({
			id: user.id,
			avatar: user.avatar,
			collectionId: 'users'
		} as any);
	}

	function getUserInitial(userId: string): string {
		const user = getUser(userId);
		if (!user) return 'U';

		return user.name.charAt(0).toUpperCase();
	}

	$: tagPlaceholder = $t('tasks.tags') as string;
	$: searchPlaceholder = $t('nav.search') as string;
	$: addPlaceholder = $t('tasks.add') as string;

	$: descriptionText =
		selectedTask?.taskDescription || $t('tasks.addDescription') || 'Add Description';

	$: toggleLabel = allColumnsOpen
		? ($t('generic.collapseAll') as string) || 'Collapse All'
		: ($t('generic.expandAll') as string) || 'Expand All';

	$: hasProjectContext = Boolean(
		(selectedTask?.project_id && selectedTask.project_id !== '') ||
			(currentProjectId && currentProjectId !== '')
	);
	$: allUserIds = [
		...new Set([
			...allTasksBackup.map((task) => task.createdBy).filter(Boolean),
			...allTasksBackup.map((task) => task.assignedTo).filter(Boolean)
		])
	];

	let lastLoadedProjectId: string | null = null;

	$: if (currentProjectId !== lastLoadedProjectId) {
		lastLoadedProjectId = currentProjectId;
		if (currentProjectId) {
			loadData(currentProjectId);
		}
		// Don't load data when currentProjectId is null/empty
	}
	// Reactive statement for taskTags with null check
	$: taskTags = selectedTask ? $tags.filter((tag) => selectedTask?.tags?.includes(tag.id)) : [];

	// Reactive statement for columnCounts
	$: columnCounts = $columns.reduce(
		(acc, column) => {
			acc[column.status] = column.tasks.length;
			return acc;
		},
		{} as Record<string, number>
	);
	$: if (allTasksBackup.length > 0) {
		populateUserCacheFromTasks();
	}
	$: totalTaskCount = allTasksBackup.length;

	$: parentTaskCount = allTasksBackup.filter((task) =>
		allTasksBackup.some((t) => t.parent_task === task.id)
	).length;

	$: subtaskCount = allTasksBackup.filter((task) => !!task.parent_task).length;

	$: highPriorityCount = allTasksBackup.filter((task) => task.priority === 'high').length;
	$: mediumPriorityCount = allTasksBackup.filter((task) => task.priority === 'medium').length;
	$: lowPriorityCount = allTasksBackup.filter((task) => task.priority === 'low').length;
	$: assignedToValue = selectedTask?.assignedTo ?? '';
	$: projectIdValue = selectedTask?.project_id ?? currentProjectId;
	$: defaultMessage = {
		id: '',
		text: '',
		content: '',
		user: userId,
		role: 'user' as const,
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: 'messages',
		parent_msg: null,
		provider: 'openai' as const,
		prompt_type: null,
		prompt_input: null,
		model: aiModel.id,
		thread: threadId || undefined,
		isTyping: false,
		isHighlighted: false,
		reactions: {
			upvote: 0,
			downvote: 0,
			bookmark: [],
			highlight: [],
			question: 0
		}
	} as InternalChatMessage;
	// onMount(() => {
	// 	pageCleanup = pageHoverManager.initialize();
	// });
	onDestroy(() => {
		unsubscribe();
		// if (pageCleanup) {
		// 	pageCleanup();
		// }
	});
</script>

{#if $isLoading}
	<div class="spinner-container">
		<div class="spinner"></div>
	</div>
{:else if $error}
	<div class="error-message">
		<p>Error: {$error}</p>
		<button on:click={() => loadData(get(projectStore).currentProjectId)}> Retry </button>
	</div>
{:else}
	<div class="lean-container" class:nav-open={$showSettings}>
		{#if $showSidenav}
			<div
				class="column-wrapper"
				on:mouseleave={() => {
					handlePageMenuLeave();
				}}
			>
				<div class="calendar-container">
					<TaskCalendar />
				</div>
				<div class="column-view-controls" transition:fly={{ x: -300, duration: 300 }}>
					<button
						class="toggle-btn columns {allColumnsOpen ? 'active' : ''}"
						on:click={toggleAllColumns}
						aria-label={toggleLabel}
					>
						<span class="toggle-icon">
							{#if allColumnsOpen}
								<Icon name="EyeOff" size={16} />
							{:else}
								<Icon name="Layers" size={16} />
							{/if}
						</span>
						<span class="toggle-label">
							{allColumnsOpen ? $t('button.tags') : $t('button.tags')}
						</span>
					</button>

					{#each $columns as column}
						<button
							class="toggle-btn toggle-{column.status} {column.isOpen
								? 'active-' + column.status
								: ''}"
							on:click={() => toggleColumn(column.id)}
							on:dragover={(e) => handleButtonDragOver(e, column.id)}
							on:dragleave={handleButtonDragLeave}
							on:drop={(e) => handleButtonDrop(e, column.id)}
						>
							<span>{column.title}</span>
							{#if column.tasks.length > 0}
								<span class="count-badge">{column.tasks.length}</span>
							{/if}
						</button>
					{/each}
				</div>
				<div class="view-controls">
					<div class="tooltip-container">
						<span class="shared-tooltip" class:visible={hoveredButton === 'all'}>
							{$t('generic.show')}
							{$t('generic.all')}
							{$t('tasks.tasks')}
						</span>
						<span class="shared-tooltip" class:visible={hoveredButton === 'parents'}>
							{$t('generic.show')}
							{$t('tasks.parent')}
							{$t('tasks.tasks')}
							{$t('generic.only')}
						</span>
						<span class="shared-tooltip" class:visible={hoveredButton === 'subtasks'}>
							{$t('generic.show')}
							{$t('tasks.subtasks')}
							{$t('dates.days')}
						</span>
					</div>

					<button
						class="priority-toggle {taskViewMode === TaskViewMode.highPriority
							? 'high'
							: taskViewMode === TaskViewMode.mediumPriority
								? 'medium'
								: taskViewMode === TaskViewMode.LowPriority
									? 'low'
									: ''}"
						on:click={(e) => togglePriorityView(e)}
						title="Toggle priority view"
					>
						<span
							class={[
								TaskViewMode.highPriority,
								TaskViewMode.mediumPriority,
								TaskViewMode.LowPriority
							].includes(taskViewMode)
								? 'active'
								: ''}
						>
							<Icon name="Flag" />
						</span>
						{#if taskViewMode === TaskViewMode.highPriority}
							<span></span>
							<span class="count-badge">{highPriorityCount}</span>
						{:else if taskViewMode === TaskViewMode.mediumPriority}
							<span></span>
							<span class="count-badge">{mediumPriorityCount}</span>
						{:else if taskViewMode === TaskViewMode.LowPriority}
							<span></span>
							<span class="count-badge">{lowPriorityCount}</span>
						{/if}
					</button>
					<button
						class:active={taskViewMode === TaskViewMode.All}
						on:click={() => toggleTaskView(TaskViewMode.All)}
						on:mouseenter={() => (hoveredButton = 'all')}
						on:mouseleave={() => (hoveredButton = null)}
					>
						<Icon name="ListCollapse" size={16} />
						<span class="count-badge">{totalTaskCount}</span>
					</button>
					<button
						class:active={taskViewMode === TaskViewMode.OnlyParentTasks}
						on:click={() => toggleTaskView(TaskViewMode.OnlyParentTasks)}
						on:mouseenter={() => (hoveredButton = 'parents')}
						on:mouseleave={() => (hoveredButton = null)}
					>
						<Icon name="FolderGit" size={16} />
						<span class="count-badge">{parentTaskCount}</span>
					</button>
					<button
						class:active={taskViewMode === TaskViewMode.OnlySubtasks}
						on:click={() => toggleTaskView(TaskViewMode.OnlySubtasks)}
						on:mouseenter={() => (hoveredButton = 'subtasks')}
						on:mouseleave={() => (hoveredButton = null)}
					>
						<Icon name="GitFork" size={16} />
						<span class="count-badge">{subtaskCount}</span>
					</button>
					<button
						class="filter-toggle"
						class:active={showTagFilter}
						on:click={toggleTagFilter}
						title="Tags"
					>
						<Icon name="Filter" size={16} />
					</button>
				</div>
				{#if showTagFilter}
					<div class="tag-filter-container" in:slide={{ duration: 150 }}>
						<div class="tag-filter-options">
							<TagsDropdown
								bind:selectedTags={selectedTagIds}
								{currentProjectId}
								mode="task"
								isFilterMode={true}
								placeholder={tagPlaceholder}
								showSelectedCount={true}
								on:tagsChanged={handleTagsChanged}
							/>

							<div class="match-options">
								<label class="toggle-label">
									<input
										type="checkbox"
										bind:checked={requireAllTags}
										on:change={toggleRequireAllTags}
									/>
									<span>{$t('generic.match')}</span>
								</label>
							</div>
						</div>

						<!-- Show active filters summary -->
						{#if selectedTagIds.length > 0}
							<div class="active-filters" transition:slide={{ duration: 150 }}>
								<span class="filter-label">{$t('generic.filter')}</span>
								<div class="filter-tags">
									{#each $tags.filter((tag) => selectedTagIds.includes(tag.id)) as tag}
										<span class="filter-tag" style="background-color: {tag.color}">
											{tag.name}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
				<div class="input-wrapper">
					<div class="global-task-input">
						<!-- <span>
								<Search />
							</span> -->
						<input
							transition:fade={{ duration: 150 }}
							type="text"
							bind:value={searchQuery}
							on:input={() => {
								searchTasks(searchQuery);
								if (searchQuery && !allColumnsOpen) {
									toggleAllColumns();
								}
							}}
							placeholder={searchPlaceholder}
							class="search-input"
						/>
						{#if searchQuery}
							<button
								class="clear-search"
								on:click={() => {
									searchQuery = '';
									applyFilters();
								}}
							>
								✕
							</button>
						{/if}
					</div>
					<div class="global-task-input">
						<!-- <span>
								<PlusCircle />
							</span> -->
						<textarea
							placeholder={addPlaceholder}
							on:keydown={(e) => addGlobalTask(e)}
							class="global-task-input"
						></textarea>
					</div>
				</div>
			</div>
		{/if}
		<div
			class="kanban-container"
			in:fly={{ y: -400, duration: 400 }}
			out:fade={{ duration: 300 }}
			class:drawer-visible={$showSidenav}
		>
			<div class="kanban-board" class:drawer-visible={$showThreadList}>
				{#each $columns as column}
					<div
						class="kanban-column column-{column.status} {column.isOpen ? 'expanded' : 'collapsed'}"
						on:dragover={handleDragOver}
						in:fly={{ x: -400, duration: 400 }}
						out:fly={{ x: -100, duration: 300 }}
						on:drop={(e) => handleDrop(e, column.id)}
					>
						<!-- <button type="button" class="column-header header-{column.status} {column.isOpen ? 'active-'+column.status : ''}" on:click={() => toggleColumn(column.id)}>
				</button> -->

						{#if column.isOpen}
							<span class="column-title">
								{column.title}
							</span>
							<div
								class="task-list"
								in:slide={{ duration: 300, axis: 'x' }}
								out:slide={{ duration: 300, easing: elasticOut, axis: 'x' }}
							>
								{#each column.tasks as task}
									<div
										class="task-card status-{task.status}"
										draggable="true"
										on:dragstart={(e) => handleDragStart(e, task.id, column.id)}
										on:dragend={handleDragEnd}
										on:click={(e) => openModal(task, e)}
									>
										<h4>
											<!-- Safe if processWordMinimize is controlled -->
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html processWordMinimize(task.title)}
										</h4>

										{#if task.parent_task}
											<div class="task-badge">
												{#await getParentTaskTitle(task.parent_task) then title}
													{title}
												{/await}
											</div>
										{/if}

										<p class="description">{task.taskDescription}</p>

										{#if task.createdBy}
											<div class="task-creator">
												{#if hasSubtasks(task.id)}
													<div class="task-badge subtasks">
														<span class="task-icon">
															<Icon name="ClipboardList" size={16} />
														</span>
														{countSubtasks(task.id)}
														<span>{$t('tasks.subtasks')}</span>
													</div>
												{/if}

												<!-- Creator info -->
												<span>
													{#if getUserAvatar(task.createdBy)}
														<img
															src={getUserAvatar(task.createdBy)}
															alt="Avatar"
															class="user-avatar"
															on:error={handleAvatarError}
														/>
														<span class="avatar-initials" style="display: none;">
															{getUserInitial(task.createdBy)}
														</span>
													{:else}
														<span class="avatar-initials">
															{getUserInitial(task.createdBy)}
														</span>
													{/if}
													<span class="username">
														{getUserDisplayName(task.createdBy)}
													</span>
												</span>

												<!-- Assigned to info -->
												<span>
													{#if task.assignedTo}
														{#if getUserAvatar(task.assignedTo)}
															<img
																src={getUserAvatar(task.assignedTo)}
																alt="Avatar"
																class="user-avatar"
																on:error={handleAvatarError}
															/>
															<span class="avatar-initials" style="display: none;">
																{getUserInitial(task.assignedTo)}
															</span>
														{:else}
															<span class="avatar-initials">
																{getUserInitial(task.assignedTo)}
															</span>
														{/if}
														<span class="username">
															{getUserDisplayName(task.assignedTo)}
														</span>
													{:else}
														<span class="no-assignment">{$t('tasks.notAssigned')}</span>
													{/if}
												</span>
											</div>
										{/if}

										{#if task.attachments && task.attachments.length > 0}
											<div class="attachment-indicator">
												📎 {task.attachments.length}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if isModalOpen && selectedTask}
	<div class="modal-overlay" on:click={() => selectedTask && saveAndCloseModal(selectedTask)}>
		<div
			class="modal-content"
			class:task-changing={taskTransition}
			on:click|stopPropagation
			in:slide={{ duration: 300, axis: 'x' }}
			out:slide={{ duration: 300, easing: elasticOut, axis: 'x' }}
		>
			{#if selectedTask?.parent_task}
				<div class="parent-task-section">
					<button
						class="tasknav-btn"
						on:click={(e) =>
							selectedTask?.parent_task && navigateToParentTask(selectedTask.parent_task, e)}
					>
						<Icon name="ChevronLeft" size={16} />
					</button>
					<p>{selectedTask?.parent_task ? getParentTaskTitle(selectedTask.parent_task) : ''}</p>
				</div>
			{/if}

			<div class="title-section">
				{#if isEditingTitle}
					<textarea
						bind:value={selectedTask.title}
						on:blur={() => (isEditingTitle = false)}
						on:keydown={(e) => e.key === 'Enter' && (isEditingTitle = false)}
						autoFocus
						class="title-input"
					/>
				{:else}
					<h1 on:click={() => (isEditingTitle = true)}>
						<!-- Safe if processWordMinimize is controlled -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html processWordMinimize(selectedTask.title)}
					</h1>
				{/if}
			</div>
			<div class="modal-header">
				{#if selectedTask}
					<div class="assignment-section">
						<AssignButton
							taskId={selectedTask.id}
							assignedTo={assignedToValue ?? ''}
							projectId={projectIdValue ?? undefined}
							on:assigned={(e) => handleTaskAssigned(e.detail)}
							on:unassigned={() => selectedTask && handleTaskUnassigned(selectedTask.id)}
						/>
					</div>
					<span
						class="priority-flag modal {selectedTask.priority}"
						on:click={(e) => selectedTask && togglePriority(selectedTask, e)}
						title="Click to change priority"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
							<line x1="4" y1="22" x2="4" y2="15"></line>
						</svg>
						<span class="priority-name">
							{selectedTask.priority}
						</span>
					</span>
				{/if}
			</div>

			<div class="tag-section">
				<div class="tag-list">
					{#each $tags as tag}
						<button
							class="tag"
							class:selected={selectedTask.tags.includes(tag.id)}
							on:click={() => toggleTag(tag.id)}
							style="background-color: {tag.color}"
							data-color={tag.color}
						>
							{tag.name}
						</button>
					{/each}
				</div>
				<div class="add-tag">
					{#if showAddTag}
						<input
							type="text"
							bind:value={newTagName}
							bind:this={addTagInput}
							placeholder="Add tag"
							on:blur={handleInputBlur}
							on:keydown={(e) => e.key === 'Enter' && addTag()}
						/>
					{/if}
					<button on:click={showAddTag ? addTag : toggleAddTag}>
						{#if showAddTag}
							<Icon name="ChevronLeft" size={16} />
						{:else}
							<Icon name="Tags" size={16} /> +
						{/if}
					</button>
				</div>
			</div>
			<div class="description-section">
				{#if isEditingDescription}
					<textarea
						bind:value={selectedTask.taskDescription}
						on:blur={() => (isEditingDescription = false)}
						autoFocus
					></textarea>
				{:else}
					<div class="description-display" on:click={() => (isEditingDescription = true)}>
						{capitalizeFirst(descriptionText)}
					</div>
				{/if}
			</div>
			<!-- Add Assignment Section after title - only if we have a valid project context -->

			{#if hasSubtasks(selectedTask.id)}
				<div class="subtasks-section" on:click|self={() => (showSubtasks = !showSubtasks)}>
					<div class="section-header">
						<p>Subtasks ({countSubtasks(selectedTask.id)})</p>
						<!-- <button class="toggle-btn" on:click={() => showSubtasks = !showSubtasks}>
                        {showSubtasks ? 'Hide' : 'Show'}
                    </button> -->
					</div>

					{#if showSubtasks}
						<div class="subtasks-list" transition:slide={{ duration: 150 }}>
							{#each getSubtasks(selectedTask.id) as subtask}
								<div class="subtask-item" on:click={(e) => openModal(subtask, e)}>
									<div class="subtask-title">
										{processWordCrop(subtask.title)}
									</div>
									<div class="subtask-status">{subtask.status}</div>
									<Icon name="ChevronRight" size={16} />
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			<div class="attachment-section">
				<p>{$t('generic.attachments')}:</p>
				<input type="file" on:change={handleFileUpload} multiple />
				<div class="attachment-list">
					{#each selectedTask.attachments as attachment}
						<a href={attachment.url} target="_blank" rel="noopener noreferrer"
							>{attachment.fileName}</a
						>
					{/each}
				</div>
			</div>

			<div class="start-section">
				<span class="timer">
					<p>{$t('tasks.start')}:</p>
					{selectedTask.start_date
						? selectedTask.start_date.toLocaleDateString()
						: $t('tasks.selectStart')}
				</span>
				<div class="timer-controls">
					<button
						class="play"
						on:click={() => setQuickStart(0)}
						class:selected={selectedStart === 0}
					>
						<span>
							<Icon name="CirclePlay" size={20} />
							{$t('dates.now')}
						</span>
					</button>
					<button on:click={() => setQuickStart(1)} class:selected={selectedStart === 1}
						>{$t('dates.today')}</button
					>
					<button on:click={setEndOfWeekStart} class:selected={selectedStart === 'endOfWeek'}
						>{$t('dates.endWeek')}</button
					>
					<button on:click={() => setQuickStart(7)} class:selected={selectedStart === 7}
						>1 {$t('dates.week')}</button
					>
					<button on:click={() => setQuickStart(14)} class:selected={selectedStart === 14}
						>2 {$t('dates.weeks')}</button
					>
					<button on:click={() => setQuickStart(30)} class:selected={selectedStart === 30}
						>1 {$t('dates.months')}</button
					>
				</div>
			</div>
			<div class="deadline-section">
				<span class="timer">
					<p>{$t('tasks.deadline')}</p>
					{selectedTask.due_date
						? selectedTask.due_date.toLocaleDateString()
						: $t('tasks.selectEnd')}
				</span>
				<div class="timer-controls">
					<button on:click={() => setQuickDeadline(0)} class:selected={selectedDeadline === 0}
						>{$t('dates.today')}</button
					>
					<button on:click={() => setQuickDeadline(1)} class:selected={selectedDeadline === 1}
						>{$t('dates.tomorrow')}</button
					>
					<button on:click={setEndOfWeekDeadline} class:selected={selectedDeadline === 'endOfWeek'}
						>{$t('dates.endWeek')}</button
					>
					<button on:click={() => setQuickDeadline(7)} class:selected={selectedDeadline === 7}
						>1 {$t('dates.week')}</button
					>
					<button on:click={() => setQuickDeadline(14)} class:selected={selectedDeadline === 14}
						>2 {$t('dates.weeks')}</button
					>
					<button on:click={() => setQuickDeadline(30)} class:selected={selectedDeadline === 30}
						>1 {$t('dates.month')}</button
					>
				</div>
			</div>

			<div class="submit-section">
				<p>{$t('generic.created')}: {selectedTask.creationDate.toLocaleDateString()}</p>
				<div class="button-group">
					<button
						class="done-button"
						on:click={() => selectedTask && saveAndCloseModal(selectedTask)}
						>{$t('tasks.done')}</button
					>
					<button
						class="delete-task-btn"
						on:click={(e) => selectedTask && openDeleteConfirm(selectedTask.id, e)}
					>
						<Icon name="Trash2" size={16} />
						<span>{$t('generic.delete')}</span>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if isDeleteConfirmOpen}
	<div class="confirm-delete-overlay">
		<div class="confirm-delete-modal">
			<h3>{$t('generic.delete')} {$t('tasks.task')}</h3>
			<p>{$t('generic.deleteQuestion')} {$t('generic.deleteWarning')}</p>

			<div class="confirm-buttons">
				<button class="cancel-btn" on:click={cancelDelete}>{$t('generic.cancel')}</button>
				<button class="confirm-btn" on:click={confirmDelete}>{$t('generic.delete')}</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		/* font-family: 'Merriweather', serif; */
		/* font-family: 'Roboto', sans-serif; */
		/* font-family: 'Montserrat'; */
		/* color: var(--text-color); */
		font-family: var(--font-family);
	}

	:root {
		--color-backlog: var(--primary-color);
		--color-todo: red;
		--color-inprogress: orange;
		--color-review: yellow;
		--color-done: green;
		--color-hold: #f3e5f5;
		--color-postpone: #ede7f6;
		--color-delegate: #1389bf;
		--color-cancel: var(--primary-color);
		--color-archive: var(--placeholder-color);

		--column-expanded-width: 400px;
	}

	.kanban-container {
		display: flex;
		flex-direction: row;
		transition: all 0.2s ease;
		margin-top: 1rem;
		margin-bottom: 1rem;

		height: calc(100vh - 4rem);
		width: auto;
		margin-left: 3rem !important;
		overflow-x: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}

	.column-wrapper {
		display: flex;
		flex-direction: column;
		align-items: space-between;
		justify-content: flex-start;
		height: calc(100% - 3rem);
		padding: 0.5rem;
		gap: 2rem;
		margin-left: 3rem;
	}
	.lean-container {
		display: flex;
	}
	// .lean-container.nav-open {
	// 	margin-left: 5rem;
	// }
	// .column-wrapper.nav-open {
	// 	margin-left: 5rem;
	// 	padding: 0.5rem;
	// 	& .kanban-container.nav-open {
	// 		margin-left: 0 !important;
	// 	}
	// }
	.input-wrapper {
		display: flex;
		width: auto;
		flex-direction: column;
		justify-content: flex-end;
		height: 100%;
		gap: 0.5rem;
	}
	p {
		font-size: 1.1rem;
		// padding: 1rem 0;
		margin: 0;
		line-height: 1.5;
		color: var(--text-color);
		opacity: 0.8;
		font-weight: 800;
		text-align: left;
		letter-spacing: 0.2rem;
		transition: all 0.3s ease;

		&.description {
			color: var(--placeholder-color);
			letter-spacing: 0;
			font-weight: 100;
			font-size: 0.8rem;
			line-height: 1.25;
			// max-height: 1rem;
			max-height: 10rem;
			overflow: hidden;
			text-align: left;
			margin-bottom: 0.5rem;
			padding: 0 0.5rem;
			display: none;
		}
	}
	.button-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 1rem;
		width: 100%;
		gap: 1rem;
	}

	.global-input-container {
		width: 100%;

		padding: 0;
		margin: 0;
		margin-left: auto;
		margin-right: 1rem;
		gap: 0.5rem;
		// box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		display: flex;
		justify-content: flex-end;
		align-items: center;
		flex-direction: column;
		height: auto;
		transition: all 0.2s ease;
		& textarea {
			display: flex;
			justify-content: center;
			align-items: center;
			text-align: left;
			height: auto;
			margin: 0;
			font-size: 0.9rem;
			height: 2rem !important;
			overflow-y: hidden;
		}
	}

	.spinner-container {
		position: fixed;
	}

	.global-task-input {
		display: flex;
		flex-direction: row;
		position: relative;
		left: auto;
		right: auto;
		margin-left: auto;
		max-width: 400px;
		gap: 1rem;
		justify-content: center;
		height: auto;
		border-radius: 2rem;
		font-size: 1.2rem;
		margin-left: 0.5rem;

		padding-inline-start: 0.5rem;
		background: var(--secondary-color);
		border-color: 1px solid var(--line-color) !important;
		transition: all 0.2s ease;
		& span {
			color: var(--placeholder-color);
			display: flex;
			justify-content: center;
			align-items: center;
			transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		}
		& input {
			display: flex;
			padding: 0.25rem;
			line-height: 1.5;
			transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
			outline: none;
			background-color: var(--secondary-color);
			width: 100%;
			border-radius: 1rem;
			font-size: 0.9rem;
			height: 1.5rem;
			border: 1px solid transparent;
		}
		& textarea {
			display: flex;
			padding: 0.25rem;
			height: 1.5rem;
			line-height: 1.5;
			transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
			outline: none;
			border: 1px solid transparent !important;
			width: 100%;
			font-size: 0.9rem;
		}
		&:hover {
			padding: 0;
			height: 2rem;
			background: transparent;
			border-color: 1px solid transparent;
			& span {
				display: none;
			}
			& textarea {
				display: flex;
				transition: all 0.2s ease;
				width: 350px;
				margin-top: 0;
				border-radius: 1rem;
				padding: 0.25rem;
				height: 2rem !important;
				background: var(--primary-color);
				resize: vertical;
				overflow-y: auto;
				overflow-x: hidden;
				white-space: pre-wrap;
				word-wrap: break-word;
				line-height: 2;
				z-index: 1;
				padding-inline-start: 1rem;
			}
			& input {
				display: flex;
				transition: all 0.2s ease;
				width: 350px;
				margin-top: 0;
				border-radius: 1rem;
				height: 2rem !important;
				background: var(--primary-color);
				overflow-y: auto;
				overflow-x: hidden;
				line-height: 1;
				z-index: 1;
				padding: 0;
				padding-inline-start: 1rem;
			}
		}
	}

	.global-task-input:focus {
		outline: none;
		width: 100%;
		border-color: var(--tertiary-color);
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
	}
	.drawer-visible.kanban-container {
		height: calc(100vh - 1rem);
	}

	.kanban-board {
		display: flex;
		flex-direction: row;
		justify-content: stretch;
		align-items: stretch;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		margin-left: 0.5rem;
		margin-right: 0.5rem;
		// backdrop-filter: blur(20px);
		border-radius: 2rem;
		border: 1px solid var(--line-color);
		transition: all 0.3s ease;
		overflow-x: scroll;
		overflow-y: hidden;
		scroll-behavior: smooth;

		&::-webkit-scrollbar {
			height: 0.5rem;
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}
	:global(.minimized-symbol) {
		color: var(--placeholder-color) !important;
		font-weight: bold;
		font-size: 0.9em;
		opacity: 0.8;
	}
	:global(.styled-word) {
		color: var(--tertiary-color) !important;
		font-weight: bold;
		font-size: 0.9em;
		opacity: 0.8;
	}
	.kanban-column {
		border-radius: 5px;
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		width: calc(25%);
		transition: all 0.3s ease;
		// border: 1px solid var(--secondary-color);
		border-radius: 2rem;
		transition: all 0.3s ease;
		height: auto;

		&:hover {
			// border: 1px solid var(--secondary-color);
			background: var(--primary-color);
		}
	}
	.column-title {
		padding: 0.5rem;
		line-height: 1;
		border-bottom: 1px solid var(--line-color) !important;
		font-size: 0.8rem;
		text-align: center;
		letter-spacing: 0.2rem;
		width: calc(100% - 2rem);

		margin-top: 0;
		margin-bottom: 0.25rem;
	}

	.column-backlog,
	.column-todo,
	.column-inprogress,
	.column-done,
	.column-review,
	.column-hold,
	.column-postpone,
	.column-delegate,
	.column-cancel,
	.column-archive {
		width: auto;
	}

	.task-card.status-backlog {
		border-left: 0.5rem solid var(--color-backlog);
	}
	.task-card.status-todo {
		//   border: 1px solid var(--color-todo);
		border-left: 0.5rem solid var(--color-todo);
	}
	.task-card.status-inprogress {
		border-left: 0.5rem solid var(--color-inprogress);
	}
	.task-card.status-review {
		border-left: 0.5rem solid var(--color-review);
	}
	.task-card.status-done {
		border-left: 0.5rem solid var(--color-done);
	}
	.task-card.status-hold {
		border-left: 0.5rem solid var(--color-hold);
	}
	.task-card.status-postpone {
		border-left: 0.5rem solid var(--color-postpone);
	}
	.task-card.status-delegate {
		border-left: 0.5rem solid var(--color-delegate);
	}
	.task-card.status-cancel {
		border-left: 0.5rem solid var(--color-cancel);
	}
	.task-card.status-archive {
		border-left: 0.5rem solid var(--color-archive);
	}

	.active-backlog {
		box-shadow: inset 0 -3px 0 var(--color-backlog);
	}
	.active-todo {
		box-shadow: inset 0 -3px 0 var(--color-todo);
	}
	.active-inprogress {
		box-shadow: inset 0 -3px 0 var(--color-inprogress);
	}
	.active-review {
		box-shadow: inset 0 -3px 0 var(--color-review);
	}
	.active-done {
		box-shadow: inset 0 -3px 0 var(--color-done);
	}
	.active-hold {
		box-shadow: inset 0 -3px 0 var(--color-hold);
	}
	.active-postpone {
		box-shadow: inset 0 -3px 0 var(--color-postpone);
	}
	.active-delegate {
		box-shadow: inset 0 -3px 0 var(--color-delegate);
	}
	.active-cancel {
		box-shadow: inset 0 -3px 0 var(--color-cancel);
	}
	.active-archive {
		box-shadow: inset 0 -3px 0 var(--color-archive);
	}

	.kanban-column.expanded[class*='column-'] {
		flex: 0 0 auto;
		overflow-x: scroll;
		overflow-y: hidden;
		width: 300px;
		&::-webkit-scrollbar {
			height: 0.25rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
			width: 0.5rem;
		}
	}
	// .kanban-column.column-cancel:has(.column-header.active-cancel) {
	//   flex: 0 0 400px;
	// }
	// .kanban-column.column-archived:has(.column-header.active-archived) {
	//   flex: 0 0 400px;
	// }

	// .kanban-column.column-backlog {
	//   background-color: var(--color-backlog);
	// }
	// .kanban-column.column-todo {
	//   background-color: var(--color-todo);
	// }
	// .kanban-column.column-inprogress {
	//   background-color: var(--color-inprogress);
	// }
	// .kanban-column.column-review {
	//   background-color: var(--color-review);
	// }
	// .kanban-column.column-done {
	//   background-color: var(--color-done);
	// }
	// .kanban-column.column-hold {
	//   background-color: var(--color-hold);
	// }
	// .kanban-column.column-postpone {
	//   background-color: var(--color-postpone);
	// }
	// .kanban-column.column-delegate {
	//   background-color: var(--color-delegate);
	// }
	// .kanban-column.column-cancel {
	//   background-color: var(--color-cancel);
	// }
	// .kanban-column.column-archive {
	//   background-color: var(--color-archive);
	// }

	.kanban-column.collapsed.column-backlog,
	.kanban-column.collapsed.column-todo,
	.kanban-column.collapsed.column-inprogress,
	.kanban-column.collapsed.column-review,
	.kanban-column.collapsed.column-done,
	.kanban-column.collapsed.column-hold,
	.kanban-column.collapsed.column-postpone,
	.kanban-column.collapsed.column-delegate,
	.kanban-column.collapsed.column-cancel,
	.kanban-column.collapsed.column-archive {
		display: none;
	}

	.kanban-column button {
		cursor: pointer;
		border-top-left-radius: 2rem;
		background: transparent;
		display: flex;
		width: auto;
		text-align: left;
		border: none;
		padding: 1rem;
		color: var(--text-color);
		font-size: 1.2em;
		font-weight: bold;
		transition: all 0.3s ease;

		&:hover {
			color: var(--tertiary-color);
			letter-spacing: 0.1rem;
		}
	}

	textarea {
		width: 100%;
		// padding: 0.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 1rem;
		border: 1px solid var(--line-color) !important;
		background-color: var(--secondary-color);
		resize: none !important;
		color: var(--text-color);
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		// font-size: 1.1em;

		&.selected {
			background-color: var(--line-color);
		}
	}

	.task-list {
		min-height: 100px;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: center;
		height: auto;
		padding: 0 0.5rem;
		border-radius: 2rem;
		gap: 0.5rem;
		// border: 1px solid var(--secondary-color);
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}

	.title-section {
		textarea.title-input {
			background: var(--primary-color);
			font-size: 1.2rem;
			// padding: 0.5rem;
			// border: 1px solid var(--line-color);
			border-radius: 1rem;
			color: var(--text-color);
			text-align: left;
			margin: 0;
			height: 2rem;
			line-height: 1.5;
			padding: 0.5rem;
		}

		h1 {
			font-size: 1.8rem;
			// border: 1px solid var(--line-color);
			border-radius: 1rem;
			color: var(--text-color);
			text-align: left;
			margin: 0;
			text-transform: capitalize;
		}
	}

	.submit-section {
		p {
			text-align: right;
			font-weight: 100;
			font-size: 0.8rem;
		}
	}

	.parent-task-section {
		flex-direction: row !important;
		// border-bottom: 1px solid var(--line-color);
		padding: 1rem;
		gap: 1rem;
		p {
			font-size: 1.3rem;
		}
	}
	.tag-section {
		display: flex;
		flex-direction: row !important;
		justify-content: space-between;
		margin: 0 !important;
		& .tag-list {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			width: auto !important;

			&:hover {
				position: relative;
				padding: 1rem;
				transform: none;
				width: auto !important;
				background: var(--bg-color);
				border-radius: 2rem;
			}
		}
	}

	.attachment-section {
		border-radius: 1rem;
		border: 1px solid var(--line-color);
		padding: 1rem;
		width: auto !important;
		display: flex;
	}

	.title-section,
	.start-section,
	.deadline-section,
	.attachment-section,
	.tag-section,
	.submit-section,
	.subtasks-section,
	.parent-task-section,
	.description-section {
		display: flex;
		flex-direction: column;
		width: 100%;
		transition: all 0.2s ease;
		& textarea {
			background: var(--primary-color);
			height: 300px;
			width: auto;
		}
		& p {
			margin: 0;
			margin-bottom: 0.5rem;
			padding: 0;
			letter-spacing: 0.1rem;
		}
	}
	.description-display {
		overflow-y: auto;
		overflow-x: hidden;
		height: 80px;
		font-size: 1.1rem;
		// border: 1px solid var(--line-color);
		border-radius: 1rem;
		line-height: 1.5;
		// padding: 1rem;
	}
	.task-card {
		// background: var(--secondary-color);
		border-top: 1px solid var(--line-color);
		border-bottom: 1px solid var(--line-color);

		border-left: 0.5rem solid var(--line-color);
		// margin-bottom: 0.5rem;
		cursor: move;
		display: flex;
		flex-direction: column;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		position: relative;
		height: auto;
		width: 100%;
		gap: 0;
		word-break: break-all;
		transition: all 0.3s ease;
		cursor: pointer;

		& h4 {
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
			word-break: keep-all;
		}
	}
	.task-card:active {
		cursor: grabbing !important;
		background: transparent;
	}
	.toggle-btn.drag-hover {
		cursor: pointer !important;
	}
	.task-card.dragging {
		cursor: grab !important;
		opacity: 0.5;
	}

	.toggle-btn.toggle-backlog.drag-hover,
	.toggle-btn.toggle-todo.drag-hover,
	.toggle-btn.toggle-inprogress.drag-hover,
	.toggle-btn.toggle-review.drag-hover,
	.toggle-btn.toggle-done.drag-hover,
	.toggle-btn.toggle-hold.drag-hover,
	.toggle-btn.toggle-postpone.drag-hover,
	.toggle-btn.toggle-delegate.drag-hover,
	.toggle-btn.toggle-cancel.drag-hover {
		background: var(--tertiary-color);
	}
	.toggle-btn.toggle-archive.drag-hover {
		background-color: #dc3545;
		z-index: 2000;
	}
	.task-card:hover {
		// transform: scale(1.05) translateX(0) rotate(0deg);
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
		// padding: 0.25rem;
		z-index: 1;

		&.description {
			overflow: hidden !important;
			// padding: 0.5rem;
		}
	}

	.task-card:active {
		transform: rotate(-3deg);
	}

	h4 {
		font-size: 0.8rem;
		line-height: 1.5;
		padding: 0.25rem 0.5rem;
		text-align: l;
		margin: 0;
		text-transform: capitalize;
		//   white-space: pre-wrap;
		//   overflow-wrap: break-word;
		//   word-wrap: break-word;
		//   word-break: normal;
		//   hyphens: auto;
		//   -webkit-hyphens: auto;
		//   -ms-hyphens: auto;
		//   -webkit-line-break: normal;
		//   line-break: normal;
		//   text-wrap: balance;
	}

	.tag-list {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0 0.5rem;
		transition: all 0.3s ease;
		color: var(--placeholder-color);
		opacity: 1;

		&:hover {
			// padding: 0.5rem;
			border-radius: 1rem;
			position: relative;
			width: calc(100% - 1rem) !important;
			background-color: var(--primary-color);
			backdrop-filter: blur(10px);

			& .tag-card {
				display: flex;
			}
			& .tag-card.unselected {
				opacity: 0.4;
				border: 1px solid #ccc;
			}
		}
		& .tag {
			color: var(--text-color);
			// opacity: 0.5;
			border: none;
			padding: 0.25rem;
			opacity: 0.5;
			border-radius: 1rem;
			font-size: 0.75rem;

			transition: all 0.3s ease;
			cursor: pointer;
			&:hover {
				opacity: 0.8;
			}
			&.selected {
				opacity: 1;
				font-weight: 800;
				box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
			}
		}
		& .tag-card {
			color: var(--text-color);
			letter-spacing: 0 !important;
			// opacity: 0.5;
			border: none;
			padding: 0.25rem;
			display: none;
			opacity: 1;
			border-radius: 1rem;
			font-size: 0.75rem;
			transition: all 0.3s ease;
			cursor: pointer;
		}
	}

	span.no-assignment {
		display: none !important;
	}

	.task-creator {
		display: flex;
		overflow: hidden;
		justify-content: flex-start;
		align-items: center;
		bottom: 0;
		margin-left: 0.5rem !important;
		// border-top: 1px solid var(--line-color);
		gap: 0.5rem;
		// padding: 0.25rem 0trem;
		margin: 0;
		margin-top: 0.5rem;
		width: 100%;
		font-size: 0.8rem;
		transition: all 0.3s ease;
		span {
			display: flex;
			justify-content: center;
			align-items: center;
			transition: all 0.2s ease;

			&:hover {
				padding: 0 0.25rem;
				& .username {
					display: flex;
				}
			}
		}
		& .username {
			display: none;
			color: var(--placeholder-color);
			letter-spacing: 0.1rem;
		}
	}

	img.user-avatar {
		width: 1.5rem !important;
		height: 1.5rem !important;
		border-radius: 50%;
		margin-right: 4px;
	}

	.username {
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.timeline-container {
		transition: all 0.3s ease;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		gap: 0.25rem;
		padding: 0.5rem !important;
		width: auto;
		& span {
			display: flex;
			flex-direction: row;
		}
		& .timeline {
			display: none;
		}

		& .timeline-wrapper {
			display: flex;
			margin-left: 1rem;
			flex-direction: column;
			justify-content: center;
			border-radius: 1rem;
			width: auto;
			padding: 0;
			gap: 0.5rem;
			transition: all 0.2s ease;
			&:hover {
				background-color: var(--primary-color);
				padding: 0.5rem;
				flex-grow: 1;
				span {
					width: 100% !important;
				}
				& .date-part {
					font-size: 0.8rem !important;
				}

				& .timeline {
					position: relative;
					align-items: center;
					display: flex;
					justify-content: center;
					flex-direction: row;
					// width: 8rem;
					display: flex;

					font-size: 0.8rem;
					background-color: row;
				}
			}
		}
		span.date-status.upcoming,
		span.date-status.overdue,
		span.date-status.due-today {
			padding: 0 !important;
			margin: 0 !important;
			display: flex;
			font-size: 0.7rem !important;
			justify-content: flex-end;
			letter-spacing: 0;
			color: var(--line-color);
		}
		&:hover {
			flex-direction: row;
			width: calc(100% - 2rem);
			margin-left: auto;
			padding: 0;

			span.date-status.upcoming,
			span.date-status.overdue,
			span.date-status.due-today {
				padding: 0 !important;
				margin: 0 !important;
				display: flex;
				font-size: 0.7rem !important;
				letter-spacing: 0;
				white-space: nowrap;
				word-break: keep-all;
				text-overflow: ellipsis;
			}
		}
	}

	.timeline {
		// color: var(--text-color);
		// padding: 0.25rem 0.5rem;
		// border-bottom-left-radius: 0.5rem;
		// border-top-right-radius: 0.5rem;
		font-size: 0.75rem;
		// display: inline-block;
		letter-spacing: 0.1rem;
		// position: absolute;
		// left: 0;
		// bottom: 0;
	}
	.timeline-container .date-part,
	.timeline-container .month-part,
	.timeline-container .year-part {
		cursor: ns-resize;
		// padding: 0.5rem;
		border-radius: 0.5rem;
		transition: all 0.2s ease;
		text-align: center;
		display: flex;
		justify-content: center;
		z-index: 10;
		&:hover {
			overflow: hidden;
		}
	}

	.timeline-container .date-part:hover,
	.timeline-container .month-part:hover,
	.timeline-container .year-part:hover {
		background-color: var(--tertiary-color);
		// padding: 0.5rem;
	}

	.timeline-container .date-part {
		min-width: 60px;
		text-align: center;
	}

	.timeline-container .month-part {
		min-width: 60px;
		text-align: center;
	}

	.timeline-container .year-part {
		min-width: 40px;
		text-align: center;
	}
	.deadline.selected {
		color: var(--text-color);
		box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
	}

	.attachment-indicator {
		position: absolute;
		bottom: 5px;
		right: 5px;
		font-size: 0.8em;
	}

	.modal-header {
		display: flex;
		flex-direction: row;
		width: 100%;
		align-items: center;
		justify-content: space-between;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.modal-content {
		backdrop-filter: blur(60px);
		color: var(--text-color);
		padding: 2rem;
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: stretch;
		border-radius: 1rem 0 0 1rem;
		border: 1px solid var(--line-color);
		border-right: none !important;
		max-width: 600px;
		width: 100%;
		right: 0;
		top: 3rem;
		bottom: 1rem;
		height: auto;
		gap: 1rem;
		position: absolute;
	}

	.timer-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		& button.play {
			display: flex;
			justify-content: center;
			align-items: center;
			height: auto;
			width: auto;
			padding: 0 0.5rem;
			transition: all 0.2s ease;
			cursor: pointer;
			span {
				gap: 0.25rem;
				display: flex;
				justify-content: center;
				align-items: center;
			}
			&:hover {
				background: var(--primary-color);
				span {
					color: var(--text-color);
				}
			}
		}
	}

	.timer-controls input[type='date'] {
		flex-grow: 1;
		padding: 5px;
		border-radius: 5px;
		border: 1px solid #ddd;
		background-color: #3a3e3c;
		color: white;
	}

	.timer-controls button {
		padding: 0.5rem;
		background: var(--secondary-color);
		color: var(--text-color);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		&:hover {
			background: var(--primary-color);
			span {
				color: var(--text-color);
			}
		}
	}

	.timer-controls button.selected {
		border: 2px solid var(--tertiary-color);
		background: var(--tertiary-color);
		color: var(--bg-color);
		box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
		font-weight: 800;
	}

	span.timer {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
		color: var(--placeholder-color);
		& p {
			color: var(--text-color);
			margin: 0;
			padding: 0;
		}
	}

	.add-tag {
		border-radius: 1rem;
		display: flex;
		gap: 0.5rem;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		width: auto;

		transition: all 0.2s ease;
	}

	.add-tag input[type='text'] {
		flex-grow: 1;
		padding: 0.5rem;
		border-radius: 2rem;
		padding-inline-start: 1rem;
		border: none;
		background-color: #3a3e3c;
		color: white;
		font-size: 1rem;
		transition: all 0.2s ease;
	}

	.add-tag button {
		padding: 0.5rem;
		width: auto;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.2rem;
		background: var(--secondary-color);
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
			background: var(--tertiary-color);
			color: var(--bg-color);
		}
	}

	input[type='file'] {
		display: flex;
		border-radius: 1rem;
		font-size: 1.4rem;
		gap: 0.5rem;
	}

	.attachment-list a {
		display: block;
		color: #4caf50;
		text-decoration: none;
		margin-bottom: 0.5rem;
	}

	.delete-task-btn {
		background: transparent;
		color: var(--placeholder-color);
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		padding: 0.5rem;
		border-radius: 2rem;
		border: none;
		gap: 0.5rem;
		transition: all 0.3s ease;
		& span {
			display: none;
			transition: all 0.3s ease;
		}
		&:hover {
			cursor: pointer;
			background: red;
			color: white;

			& span {
				display: flex;
			}
		}
	}
	.confirm-delete-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1100; /* Higher than the task modal */
	}

	.confirm-delete-modal {
		background-color: var(--secondary-color);
		border-radius: 8px;
		padding: 20px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.confirm-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 20px;
	}

	.cancel-btn {
		background-color: var(--primary-color);
		color: var(--text-color);
		border: 1px solid var(--line-color);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 1rem;
	}

	.confirm-btn {
		background-color: red;
		color: white;
		border: 1px solid var(--line-color);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 1rem;
	}
	.done-button {
		bottom: 20px;
		right: 20px;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		color: var(--text-color);
		padding: 10px 20px;
		border-radius: 20px;
		cursor: pointer;
		font-size: 1.2em;
		letter-spacing: 0.3rem;
		width: 100%;
	}

	.done-button:hover {
		background: var(--tertiary-color);
	}

	.priority-flag.modal {
		display: flex;
		justify-content: center;
		width: 6rem !important;
		margin: 0;
		padding: 0.25rem;
		border-radius: 1rem;
		top: 0;
		right: 0;
		gap: 0.5rem;
		cursor: pointer;
		& .priority-name {
			display: flex;
			flex-direction: flex-start;
			align-items: center;
			justify-content: center;
			text-transform: uppercase;
			letter-spacing: 0.2rem;
			font-size: 0.6rem;
		}
		&:hover {
			padding: 0.25rem;
			border-radius: 1rem;
			position: relative;
			justify-content: center;
			background-color: var(--primary-color);
			backdrop-filter: none;

			& .priority-name {
				display: flex;
			}
		}

		.priority-flag {
			display: inline-flex;
			align-items: center;
			user-select: none;
			gap: 0.5rem;
			border-radius: 0.5rem;
			font-size: 0.6rem;
			letter-spacing: 0.1rem;
			user-select: none;

			& .priority-name {
				display: none;
			}
			&:hover {
				padding: 1rem;
				border-radius: 1rem;
				position: absolute;
				width: 100% !important;
				justify-content: center;
				background-color: var(--primary-color);
				backdrop-filter: blur(10px);

				& .priority-name {
					display: flex;
					user-select: none;
				}
			}
		}
	}
	.priority-flag.low,
	.priority-flag.medium,
	.priority-flag.high {
		& span {
			display: none;
		}
		&:hover {
			& span {
				display: flex;
				user-select: none;
			}
		}
	}

	.priority-flag.high {
		color: #e53935;
		background-color: rgba(229, 57, 53, 0.1);
	}

	.priority-flag.medium {
		color: #fb8c00;
		background-color: rgba(251, 140, 0, 0.1);
	}

	.priority-flag.low {
		color: #43a047;
		background-color: rgba(67, 160, 71, 0.1);
	}
	.task-badge {
		display: flex;
		width: auto;
		color: var(--tertiary-color);
		padding: 0 0.5rem;
		margin: 0;

		font-size: 0.75rem;

		cursor: pointer;

		&.subtasks {
			width: 100%;
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: center;
			gap: 0.5rem;
			color: var(--placeholder-color);
			transition: all 0.2s ease;
			& span {
				display: none;
				&.task-icon {
					display: flex;
				}
			}
			&:hover {
				border-radius: 2rem;
				padding: 0.5rem 1rem;
				position: absolute;
				width: calc(100% - 2rem) !important;
				margin-left: 2rem;
				background-color: var(--primary-color);
				backdrop-filter: blur(10px);
				opacity: 1;
				& span {
					display: flex;

					&.task-icon {
						display: none;
					}
				}
			}
		}
		&:hover {
			// background: var(--tertiary-color);
			color: var(--text-color);
		}
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		user-select: none;
		&:hover {
			cursor: pointer;
			p {
				color: var(--tertiary-color);
			}
		}
	}

	.subtasks-list {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.subtask-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		width: 100% !important;
		background: var(--primary-color);
		border-radius: 4px;
		margin-bottom: 5px;
		transition: all 0.3s ease;
		&:hover {
			cursor: pointer;
			background: var(--secondary-color);
		}
	}

	.subtask-title {
		flex: 1;
		font-weight: 500;
	}

	.subtask-status {
		background: var(--color-primary-lighter);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
		margin: 0 8px;
		background: var(--secondary-color);
	}

	.tasknav-btn {
		background-color: var(--bg-color);
		color: var(--text-color);
		border: none;
		border-radius: 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.5rem;
		cursor: pointer;
	}

	.parent-task-section {
		margin-top: 15px;
		border-top: 1px solid var(--color-border);
		padding-top: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.navigate-parent-btn {
		background-color: var(--color-secondary);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		cursor: pointer;
	}

	.task-changing {
		animation: flash 0.3s;
	}

	.tag.selected {
		animation: selectPulse 0.3s ease-in-out;
		box-shadow: 0px 1px 40px 1px rgba(255, 255, 255, 0.4);
	}
	.view-controls {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
		height: auto;
		gap: 2rem;
	}

	.view-controls button {
		display: flex;
		flex-direction: row;
		background-color: transparent;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--placeholder-color);

		&:hover {
			background: var(--secondary-color);
		}
	}

	.view-controls button.active {
		background-color: var(--primary-color);
		color: var(--tertiary-color);
		// border-color: var(--color-primary);
	}

	.priority-toggle.high {
		color: #dc3545;
	}

	.priority-toggle.medium {
		color: #fd7e14;
	}

	.priority-toggle.low {
		color: #28a745;
	}

	.calendar-container {
		display: flex;
		flex-direction: column;
		max-width: 350px;
	}
	.column-view-controls {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		font-size: 0.5rem !important;
		margin: 0;
		gap: 0.5rem;
	}

	.count-badge {
		background: var(--secondary-color);
		border-radius: 12px;
		padding: 0.25rem;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 0.7rem;
		max-width: 50px;
	}
	.toggle-btn {
		padding: 0.5rem;
		border-radius: 4px;
		background: transparent;
		border: none;
		font-weight: 500;
		font-size: 0.7rem;
		width: auto;
		cursor: pointer;
		transition: all 0.2s ease;
		&.columns {
			display: flex;
			flex-direction: row;
			transition: all 0.2s ease;

			& .toggle-icon {
				color: var(--text-color);
				opacity: 0.5;
				display: flex;
				justify-content: center;
				align-items: center;
				width: 2rem;
			}
			opacity: 0.5;
			& .toggle-label {
				display: flex;
			}
			&.active {
				opacity: 1;
			}
		}
		span {
			margin: 0;
			text-align: left;
			width: 100%;
		}
		&:hover {
			width: auto;
			transform: translateX(1rem);
			letter-spacing: 0.1rem;
		}
	}

	.toggle-btn.active-backlog,
	.toggle-btn.active-todo,
	.toggle-btn.active-inprogress,
	.toggle-btn.active-review,
	.toggle-btn.active-done,
	.toggle-btn.active-hold,
	.toggle-btn.active-postpone,
	.toggle-btn.active-delegate,
	.toggle-btn.active-cancel,
	.toggle-btn.active-archive {
		//   transform: translateY(2px);
		//   box-shadow: 0 0 0 1x white inset;
		border-radius: 0.5rem;
		font-weight: 800;
		font-size: 0.8rem;
		letter-spacing: 0.1rem;
		background: var(--primary-color);
	}
	.tooltip-container {
		position: absolute;
		bottom: -0.5rem;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.shared-tooltip {
		background: var(--primary-color);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 10;
		position: absolute;
	}

	.shared-tooltip.visible {
		opacity: 1;
	}

	.shared-tooltip::after {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		transform: rotate(180deg);
		border-style: solid;
		border-color: var(--primary-color) transparent transparent transparent;
	}

	.assignment-section {
		display: flex;
		align-items: center;
	}

	.assignment-section p {
		min-width: 100px;
		font-weight: 500;
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.375rem;
		border: 1px solid var(--line-color);
		background-color: var(--bg-color);
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.filter-toggle.active {
		background-color: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 0;
		border-top-left-radius: 0.5rem;
		border-bottom-left-radius: 0.5rem;
		color: var(--primary-color);
		border-right: none;
	}

	.tag-filter-container {
		width: auto;
		background-color: var(--bg-color);
		border-radius: 0.5rem;
		margin-right: 0.5rem;
	}

	.tag-filter-options {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.match-options {
		display: flex;
		align-items: center;
		background-color: red;
		width: auto;
		display: none;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--text-color);
	}

	.toggle-label input {
		margin-right: 0.5rem;
	}

	.active-filters {
		margin-top: 0.75rem;
		border-top: 1px dashed var(--line-color);
		display: none;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-label {
		font-size: 0.75rem;
		color: var(--placeholder-color);
	}

	.filter-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filter-tag {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: white;
		font-weight: 500;
	}

	@keyframes flash {
		0% {
			background-color: var(--color-bg);
		}
		50% {
			background-color: var(--color-highlight);
		}
		100% {
			background-color: var(--color-bg);
		}
	}
	@keyframes selectPulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
		}
	}

	@media (max-width: 1000px) {
		.modal-overlay {
			align-items: center;
		}
		.modal-content {
			right: -1rem;
			max-width: 350px;
			bottom: 5rem;
			overflow-y: scroll;
			overflow-x: hidden;
		}

		.column-wrapper {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			width: 100%;
			gap: 1rem;
			z-index: 9999;
			position: relative;
			padding: 0rem;
			transform: translateY(-11rem);
			backdrop-filter: blur(10px);
			border-radius: 2rem 2rem 0 0;
			border-top: 1px solid var(--line-color);
		}
		.column-view-controls {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: stretch;
			position: relative;
			height: auto;
			width: auto;
			font-size: 0.5rem !important;
			padding: 0.5rem;
		}
		.view-controls {
			padding: 0.5rem;
			margin: 0;
			flex-direction: row;
			margin-left: 3rem;
			backdrop-filter: blur(10px);
			z-index: 1000;
			gap: 0.5rem;
		}
		// .view-controls button {
		//     display: flex;
		//     flex-direction: row;
		//     padding: 0.5rem;
		//     background-color: transparent;
		//     border: 1px solid var(--color-border);
		//     border-radius: 4px;
		//     cursor: pointer;
		//     transition: all 0.2s ease;
		//     color: var(--placeholder-color);
		//     &:hover {
		//         background: var(--secondary-color);
		//     }
		// }

		// .view-controls button.active {
		//     background-color: var(--color-primary);
		//     color: var(--tertiary-color);
		//     border-color: var(--color-primary);
		// }
		.toggle-btn.active-backlog,
		.toggle-btn.active-todo,
		.toggle-btn.active-inprogress,
		.toggle-btn.active-review,
		.toggle-btn.active-done,
		.toggle-btn.active-hold,
		.toggle-btn.active-postpone,
		.toggle-btn.active-delegate,
		.toggle-btn.active-cancel,
		.toggle-btn.active-archive {
			//   transform: translateY(2px);
			//   box-shadow: 0 0 0 1x white inset;
			border-radius: 0.5rem;
			font-weight: 800;
			font-size: 0.6rem;
			letter-spacing: 0.1rem;
			background: var(--primary-color);
		}
		.kanban-container {
			display: flex;
			flex-direction: column;
			transition: all 0.2s ease;
			height: auto;
		}

		.kanban-column {
			border-radius: 5px;
			display: flex;
			width: 100vw !important;
			flex-direction: column;
			justify-content: top;
			align-items: stretch;
			transition: all 0.3s ease;
			// border: 1px solid var(--secondary-color);
			border-radius: 1rem;
			transition: all 0.3s ease;
		}

		.kanban-column.expanded.column-backlog {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-todo {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-inprogress {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-review {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-done {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-hold {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-postpone {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-delegate {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-cancel {
			flex: 0 0 300px;
		}
		.kanban-column.expanded.column-archive {
			flex: 0 0 300px;
		}
		.kanban-column.column-cancel:has(.column-header.active-cancel) {
			flex: 0 0 100%;
		}

		.kanban-column {
			height: 100px !important;
			overflow-x: scroll;
		}

		.column-title {
			position: relative;
			font-size: 1rem;
			padding-inline-start: 1.5rem;
			border-bottom: none !important;
			border-top: 1px solid var(--line-color);
			display: flex;
		}
		.toggle-btn {
			width: auto;
			padding: 0.5rem;
			&:hover {
				transform: translateX(0);
				padding: 0.5rem;
				width: auto;
				box-shadow: 0px 1px 100px 1px rgba(255, 255, 255, 0.2);
				letter-spacing: 0;
			}
		}
		.task-list {
			height: auto;
			display: flex;
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: flex-end;
			margin: 0;
			padding: 1rem;
			align-items: stretch;
			gap: 0.25rem;
			margin-top: 0.5rem !important;
			margin-right: 1rem;
			width: auto;
			overflow-y: scroll;
			&::-webkit-scrollbar {
				width: 0.5rem;
				background-color: transparent;
			}
			&::-webkit-scrollbar-track {
				background: transparent;
			}
			&::-webkit-scrollbar-thumb {
				background: var(--placeholder-color);
				border-radius: 1rem;
			}
		}

		.task-card {
			background: var(--secondary-color);
			border-radius: 1rem;
			margin-bottom: 0.5rem;
			cursor: move;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
			position: relative;
			flex: 1 1 100%;
			min-width: 200px;
			max-width: calc(33% - 1rem);
			//width may break horizontal shift scroll
			word-break: break-word;
			transition: all 0.3s ease;
			&:hover {
				& .description-display {
					display: none;
				}
				& p.description-display {
					display: none;
				}
			}
		}
		.task-card:hover {
			transform: translateX(0) translateY(0);
			padding: 0;
			// transform: scale(1.05) translateX(0) rotate(2deg);
			box-shadow: none;
			// box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
			// border: 1px solid var(--line-color);
			border: 1px solid transparent;
			z-index: 1;
			&.description {
				overflow: visible !important;
				padding: 1rem;
				max-height: auto !important;
			}

			p.description {
				display: none;
				height: 100% !important;
			}
		}

		.task-card:active {
			transform: rotate(-3deg);
		}

		.title-section {
			h1 {
				font-size: 1.4rem;
				// border: 1px solid var(--line-color);
				border-radius: 1rem;
				color: var(--text-color);
				text-align: left;
				margin: 0;
				text-transform: capitalize;
			}
		}
		.title-section,
		.start-section,
		.deadline-section,
		.attachment-section,
		.tag-section,
		.submit-section,
		.subtasks-section,
		.parent-task-section,
		.description-section {
			display: flex;
			flex-direction: column;
			max-width: 450px;
			width: auto !important;
			& textarea {
				background: var(--primary-color);
				height: 300px;
				width: auto;
				font-size: 0.9rem;
			}
			& p {
				margin: 0;
				margin-bottom: 0.5rem;
				padding: 0;
				font-size: 0.9rem;
			}
		}
		.description-display {
			overflow-y: auto;
			height: 80px;
			font-size: 0.9rem;
			// border: 1px solid var(--line-color);
			border-radius: 1rem;
			padding: 1rem;
		}
		.timer-controls {
			display: flex;
			flex-wrap: wrap;
			gap: 5px;
			margin-top: 5px;
		}

		.timer-controls input[type='date'] {
			flex-grow: 1;
			padding: 5px;
			border-radius: 5px;
			border: 1px solid #ddd;
			background-color: #3a3e3c;
			color: white;
		}

		.timer-controls button {
			padding: 5px 10px;
			background: var(--secondary-color);
			color: var(--text-color);
			border: none;
			border-radius: 0.5rem;
			cursor: pointer;
			font-size: 0.9rem;
			line-height: 2;
		}

		.timer-controls button.selected {
			border: 2px solid var(--tertiary-color);
			background: var(--tertiary-color);
			color: var(--bg-color);
			box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
			font-weight: 800;
		}

		.add-tag {
			border-radius: 1rem;
			margin-top: 1rem;
			display: flex;
			gap: 10px;
		}

		.add-tag input[type='text'] {
			flex-grow: 1;
			padding: 5px;
			border-radius: 2rem;
			padding-inline-start: 1rem;
			border: none;
			background-color: #3a3e3c;
			color: white;
			font-size: 0.9rem;
		}

		.add-tag button {
			padding: 0.5rem;
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			width: auto;
			font-size: 0.9rem;
			background: var(--secondary-color);
			color: white;
			border: none;
			border-radius: 5px;
			cursor: pointer;
			&:hover {
				box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
				background: var(--tertiary-color);
				color: var(--bg-color);
			}
		}

		.tag-section {
			flex-direction: column !important;
		}

		input[type='file'] {
			display: flex;
			border-radius: 1rem;
			font-size: 0.9rem;
			gap: 0.5rem;
		}
		.attachment-list {
			margin-top: 10px;
		}

		.attachment-list a {
			display: block;
			color: #4caf50;
			text-decoration: none;
			margin-bottom: 5px;
		}

		.kanban-board {
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			overflow-y: scroll;
			overflow-x: hidden;
			width: 98%;
			margin-right: 2rem;
			height: 90vh !important;
			border-radius: 2rem;
			border: 1px solid var(--line-color);
			padding: 0;
			margin: 0;
		}
		.kanban-column {
			// max-width: 100%;
			display: flex;
			flex-direction: column;
		}

		.timeline-container {
			transition: all 0.3s ease;
			display: flex;
			flex-direction: row;
			justify-content: flex-end;
			gap: 0.25rem;
			padding: 0.5rem !important;
			width: auto;
			& span {
				display: flex;
				flex-direction: row;
			}
			& .timeline {
				display: none;
			}

			& .timeline-wrapper {
				display: flex;
				margin-left: 1rem;
				flex-direction: column;
				justify-content: flex-end;
				border-radius: 1rem;
				width: auto;
				padding: 0;
				transition: all 0.2s ease;
				&:hover {
					background-color: var(--primary-color);
					padding: 0.5rem;
					flex-grow: 1;
					span {
						width: 100% !important;
					}
					& .date-part {
						font-size: 1rem !important;
					}

					& .timeline {
						position: relative;
						align-items: center;
						display: flex;
						justify-content: center;
						flex-direction: row;
						// width: 8rem;
						display: flex;

						font-size: 1rem;
						background-color: row;
					}
				}
			}
			span.date-status.upcoming,
			span.date-status.overdue,
			span.date-status.due-today {
				padding: 0 !important;
				margin: 0 !important;
				display: flex;
				font-size: 0.7rem !important;
				justify-content: flex-end;
				letter-spacing: 0;
				color: var(--line-color);
			}
			&:hover {
				flex-direction: row;
				width: calc(100% - 2rem);
				margin-left: 1rem;
				padding: 0;

				span.date-status.upcoming,
				span.date-status.overdue,
				span.date-status.due-today {
					padding: 0 !important;
					margin: 0 !important;
					display: flex;
					font-size: 0.7rem !important;
					letter-spacing: 0;
				}
			}
		}

		.timeline {
			// color: var(--text-color);
			// padding: 0.25rem 0.5rem;
			// border-bottom-left-radius: 0.5rem;
			// border-top-right-radius: 0.5rem;
			font-size: 0.75rem;
			// display: inline-block;
			letter-spacing: 0.1rem;
			// position: absolute;
			// left: 0;
			// bottom: 0;
		}
		.timeline-container .date-part,
		.timeline-container .month-part,
		.timeline-container .year-part {
			cursor: ns-resize;
			// padding: 0.5rem;
			border-radius: 0.5rem;
			transition: all 0.2s ease;
			text-align: center;
			display: flex;
			font-size: 0.5rem !important;
			justify-content: center;
			z-index: 10;
			&:hover {
				overflow: hidden;
			}
		}

		.timeline-container .date-part:hover,
		.timeline-container .month-part:hover,
		.timeline-container .year-part:hover {
			background-color: var(--tertiary-color);
			// padding: 0.5rem;
		}

		.timeline-container .date-part {
			min-width: 40px;
			text-align: center;
			font-size: 0.5rem !important;
		}

		.timeline-container .month-part {
			min-width: 36px;
			text-align: center;
		}

		.timeline-container .year-part {
			min-width: 40px;
			text-align: center;
		}
		.input-wrapper {
			width: 100%;
			position: relative;
			display: flex;
			flex-direction: row;
			justify-content: flex-end;
			height: auto;
			margin-right: 2rem;
			width: 100%;
		}
	}

	@media (max-width: 768px) {
		.global-input-container {
			justify-content: flex-start;
			align-items: center;
			width: 100%;
			margin: 0;
		}
		.global-task-input:focus {
			outline: none;
			position: relative;
			width: auto;
			border-color: var(--tertiary-color);
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
		}

		.kanban-container {
			display: flex;
			flex-direction: column;
			transition: all 0.2s ease;
			height: auto;
		}

		.view-controls {
			gap: 1rem;
		}
		.kanban-board {
			height: 78vh;
			margin-left: 0.5rem;
		}
		.task-card {
			background: var(--secondary-color);
			border-radius: 1rem;
			margin-bottom: 0.5rem;
			flex: 1 1 100%;
			min-width: 120px;
			max-width: calc(30% - 0.5rem);
			cursor: move;
			transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
			position: relative;
			word-break: break-all;
			transition: all 0.3s ease;
		}

		.task-card:hover {
			transform: translateX(0);
			// transform: scale(1.05) translateX(0) rotate(2deg);
			box-shadow: none;
			// box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
			// border: 1px solid var(--line-color);
			border: 1px solid transparent;
			z-index: 1;

			&.description {
				overflow: visible !important;
				padding: 1rem;
				max-height: auto !important;
			}

			p.description {
				display: none;
				height: 100% !important;
			}
		}

		.task-card:active {
			transform: rotate(-1deg);
		}
		.column-view-controls {
			display: flex;
			flex-direction: row;
			justify-content: flex-end;
			align-items: flex-start;
			height: auto;
			flex-wrap: wrap;
			width: auto !important;
			font-size: 0.5rem !important;
			bottom: 1rem;
		}

		h4 {
			font-size: 0.9rem;
			padding: 0 0.5rem;
			margin: 0;
			margin-top: 0.25rem;
		}
	}
	@media (max-width: 450px) {
		.kanban-container {
			flex-direction: column;
		}
		.modal-content {
			backdrop-filter: blur(60px);
			color: var(--text-color);
			padding: 2rem;
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			align-items: stretch;
			border-radius: 1rem;
			border: 1px solid var(--line-color);
			border-right: 1px solid var(--line-color) !important;
			max-width: auto !important;
			width: auto;
			right: 0rem;
			left: 0rem;
			overflow: hidden;
			top: 7rem;
			bottom: 20rem;
			height: auto;
			gap: 1rem;
			position: absolute;
		}
		.column-view-controls {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: stretch;
			position: absolute;
			z-index: 2000;
			height: auto;
			width: auto !important;
			font-size: 0.5rem !important;
			bottom: -1.5rem;
			backdrop-filter: blur(10px);
		}

		.global-input-container {
			position: fixed;
			bottom: 4rem;
		}

		.global-task-input {
			position: fixed;
			background: var(--primary-color);
			bottom: 1rem;
			right: 1rem;
			left: 4rem;
			width: auto;
			z-index: 1;
			& span {
				display: none;
			}

			& textarea {
				display: flex;
				background-color: var(--secondary-color);
			}
		}
		.global-task-input:focus {
			position: fixed;
			background: var(--primary-color);
			bottom: 1.2rem;
			right: 1rem;
			left: 6rem;
			width: auto;
			z-index: 1;
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
		}
		.tooltip-container {
			display: none;
		}
		.kanban-board {
			margin-right: 0.5rem !important;
			width: auto;
			height: 78vh !important;
		}
	}
</style>
