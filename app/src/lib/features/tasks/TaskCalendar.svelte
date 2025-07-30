<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { writable, get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import { projectStore } from '$lib/stores/projectStore';
	import type { KanbanTask, KanbanAttachment, Tag } from '$lib/types/types';
	import { fade } from 'svelte/transition';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type { Task } from '$lib/types/types';

	type ViewMode = 'month-grid' | 'month-group';
	let viewMode: ViewMode = 'month-group';
	let selectedDayTasks: KanbanTask[] = [];
	let currentProjectId: string | null = null;
	// Calendar state
	let currentDate = new Date();
	let calendarGrid = writable<{
		days: Day[];
		month: string;
		year: number;
	}>({ days: [], month: '', year: 0 });
	let isTaskListModalOpen = false;
	let selectedDay: Day | null = null;

	// Interface for calendar days
	interface Day {
		date: Date;
		dayOfMonth: number;
		isCurrentMonth: boolean;
		tasks: KanbanTask[];
	}

	projectStore.subscribe((state) => {
		currentProjectId = state.currentProjectId;
	});

	// State
	let tasks = writable<KanbanTask[]>([]);
	let tags = writable<Tag[]>([]);
	let isLoading = writable(true);
	let error = writable<string | null>(null);
	let selectedTask: KanbanTask | null = null;
	let isModalOpen = false;
	let isEditingDescription = false;
	let isEditingTitle = false;

	// Month grouping view
	let showMonthGroupView = true;
	let monthGroups = writable<Record<string, { name: string; tasks: KanbanTask[] }>>({});

	// Format date helper function
	function formatDateForInput(date: Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	function formatDateDisplay(date: Date | null): string {
		if (!date) return 'No date';
		const d = new Date(date);
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}.${month}.${year}`;
	}

	async function loadData() {
		isLoading.set(true);
		error.set(null);

		try {
			// Load tasks
			await loadTasks();

			// Load tags
			await loadTags();

			// Update month groups for grouped view - only after tasks are loaded
			updateMonthGroups();
			updateCalendarGrid();
			isLoading.set(false);
		} catch (err: unknown) {
			console.error('Error loading data:', err);
			error.set(err instanceof Error ? err.message : 'Failed to load data');
			isLoading.set(false);
		}
	}

	async function loadTasks() {
		try {
			let url = '/api/tasks';
			if (currentProjectId) {
				url = `/api/projects/${currentProjectId}/tasks`;
			}

			const response = await fetch(url);
			if (!response.ok) throw new Error('Failed to fetch tasks');

			const data = await response.json();

			// Add safety check for data.items
			if (!data || !Array.isArray(data.items)) {
				console.warn('Invalid API response format:', data);
				tasks.set([]);
				return;
			}

			// Process tasks
			const tasksList = data.items.map((task: Task) => ({
				id: task.id,
				title: task.title,
				taskDescription: task.taskDescription || '',
				creationDate: new Date(task.created),
				due_date: task.due_date ? new Date(task.due_date) : null,
				tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
				attachments: [],
				project_id: task.project_id,
				createdBy: task.createdBy,
				allocatedAgents: task.allocatedAgents || [],
				status: task.status,
				priority: task.priority || 'medium',
				prompt: task.prompt || '',
				context: task.context || '',
				task_outcome: task.task_outcome || '',
				dependencies: task.dependencies || [],
				agentMessages: task.agentMessages || []
			}));

			tasks.set(tasksList);
		} catch (err) {
			console.error('Error loading tasks:', err);
			// Set empty array on error to prevent further issues
			tasks.set([]);
			throw err;
		}
	}

	async function loadTags() {
		try {
			let url = '/api/tags';
			if (currentProjectId) {
				url = `/api/projects/${currentProjectId}/tags`;
			}

			const response = await fetch(url);
			if (!response.ok) throw new Error('Failed to fetch tags');

			const data = await response.json();
			tags.set(data.items);
		} catch (err) {
			console.error('Error loading tags:', err);
			throw err;
		}
	}

	// Group tasks by month for the month view
	function updateMonthGroups() {
		const taskList = get(tasks);

		// Add null check to prevent errors
		if (!taskList || !Array.isArray(taskList)) {
			monthGroups.set({
				'no-date': {
					name: 'No Due Date',
					tasks: []
				}
			});
			return;
		}

		// Fixed syntax - use type assertion instead of type annotation
		const groups = {} as Record<string, { name: string; tasks: KanbanTask[] }>;

		// First ensure we have the "no-date" group
		groups['no-date'] = {
			name: 'No Due Date',
			tasks: []
		};

		taskList.forEach((task) => {
			if (task.due_date) {
				try {
					// Safely convert to Date object
					let dateObj: Date;

					if (task.due_date instanceof Date) {
						dateObj = task.due_date;
					} else if (typeof task.due_date === 'string') {
						dateObj = new Date(task.due_date);
					} else {
						// If conversion fails, add to no-date group
						groups['no-date'].tasks.push(task);
						console.warn(`Invalid date format for task ${task.id}:`, task.due_date);
						return;
					}

					// Check if date is valid
					if (isNaN(dateObj.getTime())) {
						groups['no-date'].tasks.push(task);
						console.warn(`Invalid date for task ${task.id}:`, task.due_date);
						return;
					}

					const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}`;
					const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

					if (!groups[monthKey]) {
						groups[monthKey] = {
							name: monthName,
							tasks: []
						};
					}

					groups[monthKey].tasks.push(task);
				} catch (err) {
					groups['no-date'].tasks.push(task);
					console.error(`Error processing date for task ${task.id}:`, err);
				}
			} else {
				// Tasks without due dates
				groups['no-date'].tasks.push(task);
			}
		});

		monthGroups.set(groups);
	}
	async function updateTaskDueDate(taskId: string, dueDate: Date | null) {
		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					due_date: dueDate ? dueDate.toISOString() : null
				})
			});

			if (!response.ok) throw new Error('Failed to update task due date');

			return await response.json();
		} catch (err: unknown) {
			console.error('Error updating task due date:', err);
			throw err;
		}
	}
	function updateCalendarGrid() {
		const taskList = get(tasks);

		// Add null check to prevent the error
		if (!taskList || !Array.isArray(taskList)) {
			calendarGrid.set({
				days: [],
				month: currentDate.toLocaleString('default', { month: 'long' }),
				year: currentDate.getFullYear()
			});
			return;
		}

		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();

		// Get first day of month
		const firstDay = new Date(year, month, 1);
		// Get last day of month
		const lastDay = new Date(year, month + 1, 0);

		/*
		 * Get day of week of first day (0 = Sunday, 6 = Saturday)
		 * Convert to Monday = 0, Sunday = 6 format
		 */
		const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

		// Create array of days
		const days: Day[] = [];

		// Add days from previous month to fill first week
		const daysFromPrevMonth = firstDayOfWeek;
		for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
			const date = new Date(year, month, -i);
			days.push({
				date,
				dayOfMonth: date.getDate(),
				isCurrentMonth: false,
				tasks: taskList.filter((task) => {
					if (!task.due_date) return false;
					const taskDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);
					return (
						taskDate.getDate() === date.getDate() &&
						taskDate.getMonth() === date.getMonth() &&
						taskDate.getFullYear() === date.getFullYear()
					);
				})
			});
		}

		// Add all days of current month
		const daysInMonth = lastDay.getDate();
		for (let i = 1; i <= daysInMonth; i++) {
			const date = new Date(year, month, i);
			days.push({
				date,
				dayOfMonth: i,
				isCurrentMonth: true,
				tasks: taskList.filter((task) => {
					if (!task.due_date) return false;
					const taskDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);
					return (
						taskDate.getDate() === i &&
						taskDate.getMonth() === month &&
						taskDate.getFullYear() === year
					);
				})
			});
		}

		// Add days from next month to complete grid (typically 42 days total for 6 weeks)
		const totalDaysNeeded = 42;
		const daysFromNextMonth = totalDaysNeeded - days.length;
		for (let i = 1; i <= daysFromNextMonth; i++) {
			const date = new Date(year, month + 1, i);
			days.push({
				date,
				dayOfMonth: i,
				isCurrentMonth: false,
				tasks: taskList.filter((task) => {
					if (!task.due_date) return false;
					const taskDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);
					return (
						taskDate.getDate() === i &&
						taskDate.getMonth() === month + 1 &&
						taskDate.getFullYear() === year
					);
				})
			});
		}

		calendarGrid.set({
			days,
			month: firstDay.toLocaleString('default', { month: 'long' }),
			year
		});
	}

	// Add these navigation functions
	function previousMonth() {
		currentDate.setMonth(currentDate.getMonth() - 1);
		updateCalendarGrid();
	}

	function nextMonth() {
		currentDate.setMonth(currentDate.getMonth() + 1);
		updateCalendarGrid();
	}

	function goToToday() {
		currentDate = new Date();
		updateCalendarGrid();
	}
	function openTaskDetails(task: KanbanTask) {
		selectedTask = { ...task }; // Create a copy to avoid direct store mutation
		isTaskListModalOpen = false;
		isModalOpen = true;
	}
	function closeTaskListModal() {
		isTaskListModalOpen = false;
		selectedDay = null;
	}
	function handleDayClick(day: Day) {
		// For days with tasks, show the task list modal first
		if (day.tasks.length > 0) {
			selectedDay = day;
			selectedDayTasks = day.tasks;
			isTaskListModalOpen = true;
		} else {
			selectedTask = {
				id: `local_${Date.now()}`,
				title: 'New Task',
				taskDescription: '',
				creationDate: new Date(),
				start_date: new Date(day.date),
				due_date: new Date(day.date),
				tags: [],
				attachments: [],
				project_id: currentProjectId || undefined,
				createdBy: get(currentUser)?.id,
				allocatedAgents: [],
				status: 'todo',
				priority: 'medium',
				prompt: '',
				context: '',
				task_outcome: '',
				dependencies: []
			};
			isModalOpen = true;
			isEditingTitle = true;
		}
	}
	async function saveTask(task: KanbanTask) {
		try {
			const currentUserData = get(currentUser);
			const taskData: Partial<Task> & { taggedTasks: string } = {
				title: task.title,
				taskDescription: task.taskDescription,
				project_id: currentProjectId || '',
				createdBy: currentUserData?.id || '',
				status: task.status,
				priority: task.priority || 'medium',
				taggedTasks: task.tags.join(','),
				taskTags: task.tags,
				allocatedAgents: task.allocatedAgents || []
			};

			// Handle due date
			if (task.due_date) {
				const dueDate = task.due_date instanceof Date ? task.due_date : new Date(task.due_date);
				taskData.due_date = dueDate.toISOString();
			} else {
				taskData.due_date = null;
			}

			// ... rest of the function stays the same
		} catch (err: unknown) {
			console.error('Error saving task:', err);
			throw err;
		}
	}

	// Save and close modal
	function saveAndCloseModal() {
		if (selectedTask) {
			saveTask(selectedTask)
				.then(() => {
					isModalOpen = false;
					selectedTask = null;
				})
				.catch((err: unknown) => {
					const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
					error.set(`Failed to save task: ${errorMessage}`);
				});
		}
	}
	// Close modal without saving
	function closeModal() {
		isModalOpen = false;
		selectedTask = null;
	}

	// Delete task
	async function deleteTask(taskId: string) {
		try {
			// Check if task is local only
			if (taskId.startsWith('local_')) {
				tasks.update((tasksList) => tasksList.filter((t) => t.id !== taskId));
				return;
			}

			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete task');

			// Remove from tasks store
			tasks.update((tasksList) => tasksList.filter((t) => t.id !== taskId));

			// Update month groups
			updateMonthGroups();
		} catch (err: unknown) {
			console.error('Error deleting task:', err);
			throw err;
		}
	}

	// Create new task
	function createNewTask() {
		const today = new Date();

		const newTask: KanbanTask = {
			id: `local_${Date.now()}`,
			title: 'New Task',
			taskDescription: '',
			creationDate: new Date(),
			start_date: null,
			due_date: today,
			tags: [],
			attachments: [],
			project_id: currentProjectId || undefined,
			createdBy: get(currentUser)?.id,
			allocatedAgents: [],
			status: 'todo',
			priority: 'medium'
		};

		selectedTask = newTask;
		isModalOpen = true;
		isEditingTitle = true;
	}

	// Drag and drop handling
	function onDragStart(event: DragEvent, task: KanbanTask) {
		if (event.dataTransfer) {
			event.dataTransfer.setData(
				'text/plain',
				JSON.stringify({
					taskId: task.id,
					currentMonth:
						task.due_date instanceof Date
							? `${task.due_date.getFullYear()}-${task.due_date.getMonth() + 1}`
							: 'no-date'
				})
			);
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function onDrop(event: DragEvent, targetMonth: string) {
		event.preventDefault();
		if (!event.dataTransfer) return;

		const data = JSON.parse(event.dataTransfer.getData('text/plain'));
		const taskId = data.taskId;
		const sourceMonth = data.currentMonth;

		if (sourceMonth === targetMonth) return; // No change needed

		// Find the task
		const taskList = get(tasks);
		const task = taskList.find((t) => t.id === taskId);

		if (!task) return;

		// If dropping to 'no-date'
		if (targetMonth === 'no-date') {
			tasks.update((list) => {
				return list.map((t) => {
					if (t.id === taskId) {
						// Update backend
						updateTaskDueDate(taskId, null);
						return { ...t, due_date: null };
					}
					return t;
				});
			});
			updateMonthGroups();
			return;
		}

		// Parse target month
		const [year, month] = targetMonth.split('-').map(Number);

		// Get current date or create new one
		const currentDate =
			task.due_date instanceof Date
				? new Date(task.due_date)
				: task.due_date
					? new Date(task.due_date)
					: new Date();

		// Set new month and year, keep the day
		const newDate = new Date(currentDate);
		newDate.setFullYear(year);
		newDate.setMonth(month - 1); // JavaScript months are 0-indexed

		// Make sure the day is valid (handle month end cases)
		const daysInMonth = new Date(year, month, 0).getDate();
		if (newDate.getDate() > daysInMonth) {
			newDate.setDate(daysInMonth);
		}

		// Update task
		tasks.update((list) => {
			return list.map((t) => {
				if (t.id === taskId) {
					// Update backend
					updateTaskDueDate(taskId, newDate);
					return { ...t, due_date: newDate };
				}
				return t;
			});
		});

		updateMonthGroups();
	}

	// Sort months chronologically
	function getSortedMonths(monthGroups: Record<string, { name: string; tasks: KanbanTask[] }>) {
		return Object.entries(monthGroups)
			.filter(([key]) => key !== 'no-date') // Filter out 'no-date'
			.sort(([keyA], [keyB]) => {
				if (keyA === 'no-date') return -1;
				if (keyB === 'no-date') return 1;
				return keyA.localeCompare(keyB);
			});
	}
	function isToday(date: Date): boolean {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	}
	onMount(() => {
		loadData();
	});
</script>

{#if $isLoading}
	<div class="spinner-container">
		<div class="spinner"></div>
	</div>
{:else if $error}
	<div class="error-message">
		<p>Error: {$error}</p>
		<button on:click={loadData}>Retry</button>
	</div>
{:else}
	<div class="calendar-header">
		<div class="calendar-controls">
			<button class="calendar-btn" on:click={previousMonth}>&lt;</button>
			<h3>{$calendarGrid.month} {$calendarGrid.year}</h3>
			<button class="calendar-btn" on:click={nextMonth}>&gt;</button>
			<button class="calendar-btn today" on:click={goToToday}>Today</button>
		</div>
		<button class="add-btn" on:click={createNewTask}>+</button>
	</div>
	<div class="task-calendar-container" transition:fade={{ duration: 150 }}>
		<div class="calendar-grid">
			<!-- Weekday headers -->
			<div class="weekday">Mon</div>
			<div class="weekday">Tue</div>
			<div class="weekday">Wed</div>
			<div class="weekday">Thu</div>
			<div class="weekday">Fri</div>
			<div class="weekday">Sat</div>
			<div class="weekday">Sun</div>

			<!-- Calendar days - Add safety check for $calendarGrid.days -->
			{#if $calendarGrid && $calendarGrid.days && Array.isArray($calendarGrid.days)}
				{#each $calendarGrid.days as day}
					<div
						class="calendar-day"
						class:other-month={!day.isCurrentMonth}
						on:click={() => handleDayClick(day)}
					>
						<div class="day-number {isToday(day.date) ? 'current-date' : ''}">
							{day.dayOfMonth}
						</div>
						<div class="day-tasks">
							{#if day.tasks && Array.isArray(day.tasks) && day.tasks.length > 0}
								{#each day.tasks.slice(0, 3) as task}
									<div
										class="day-task"
										style="background-color: {task.priority === 'high'
											? '#e53e3e'
											: task.status === 'done'
												? '#48bb78'
												: task.status === 'inprogress'
													? '#ed8936'
													: '#4299e1'}"
									>
										<span>
											{task.title}
										</span>

										{#if task.tags && Array.isArray(task.tags) && task.tags.length > 0 && $tags && Array.isArray($tags)}
											<div class="tag-list">
												{#each $tags.filter((tag) => task.tags.includes(tag.id)) as tag}
													<span class="tag" style="background-color: {tag.color}">
														<span class="tag-hidden">
															{tag.name}
														</span>
													</span>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
								{#if day.tasks.length > 3}
									<div class="more-tasks">+{day.tasks.length - 3} more</div>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<!-- Task Modal -->
{#if isModalOpen && selectedTask}
	<div class="modal-overlay" on:click={closeModal} transition:fade={{ duration: 150 }}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-container form">
				{#if isEditingTitle}
					<textarea
						bind:value={selectedTask.title}
						on:blur={() => (isEditingTitle = false)}
						on:keydown={(e) => e.key === 'Enter' && (isEditingTitle = false)}
						autoFocus
						class="title-input"
					/>
				{:else}
					<h2 on:click={() => (isEditingTitle = true)}>
						{selectedTask.title}
					</h2>
				{/if}

				<div class="description-section">
					<p>Description:</p>
					{#if isEditingDescription}
						<textarea
							bind:value={selectedTask.taskDescription}
							on:blur={() => (isEditingDescription = false)}
							autoFocus
						></textarea>
					{:else}
						<div class="description-display" on:click={() => (isEditingDescription = true)}>
							{selectedTask.taskDescription || 'Click to add a description'}
						</div>
					{/if}
				</div>

				<div class="due-date-section">
					<p>Due Date:</p>
					<div class="date-input-wrapper">
						<input
							class="due"
							type="date"
							value={selectedTask.due_date ? formatDateForInput(selectedTask.due_date) : ''}
							on:change={(e) => {
								if (selectedTask && e.target instanceof HTMLInputElement) {
									selectedTask.due_date = e.target.value ? new Date(e.target.value) : null;
									selectedTask = selectedTask;
								}
							}}
						/>
					</div>
				</div>
				<div class="status-control">
					<div class="status-section">
						<p>Status:</p>
						<select bind:value={selectedTask.status}>
							<option value="backlog">Backlog</option>
							<option value="todo">To Do</option>
							<option value="inprogress">In Progress</option>
							<option value="done">Done</option>
						</select>
					</div>

					<div class="priority-section">
						<p>Priority:</p>
						<select bind:value={selectedTask.priority}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>
				</div>
				<div class="tag-section">
					<p>Tags:</p>
					<div class="tag-list">
						{#if $tags && Array.isArray($tags)}
							{#each $tags as tag}
								<button
									class="tag-modal"
									class:selected={selectedTask.tags &&
										Array.isArray(selectedTask.tags) &&
										selectedTask.tags.includes(tag.id)}
									on:click={() => {
										if (selectedTask?.tags) {
											if (selectedTask.tags.includes(tag.id)) {
												selectedTask.tags = selectedTask.tags.filter((id) => id !== tag.id);
											} else {
												selectedTask.tags = [...selectedTask.tags, tag.id];
											}
											selectedTask = { ...selectedTask };
										}
									}}
									style="background-color: {tag.color}"
								>
									{tag.name}
								</button>
							{/each}
						{/if}
					</div>
				</div>
				<div class="buttons">
					<button
						class="action-btn delete"
						on:click={() => {
							if (selectedTask) {
								const taskId = selectedTask.id;
								closeModal();
								deleteTask(taskId);
							}
						}}
					>
						<Icon name="Trash2" /> <span>Delete</span>
					</button>
					<span>
						<button class="action-btn cancel" on:click={closeModal}>Cancel</button>
						<button class="action-btn save" on:click={saveAndCloseModal}>Save</button>
					</span>
				</div>
			</div>
			<!-- <div class="modal-container">
				{#if selectedDayTasks && Array.isArray(selectedDayTasks) && selectedDayTasks.length > 0}
					<div class="day-tasks-section">
						<h3>Tasks for {formatDateDisplay(selectedTask.due_date)}</h3>
						<div class="day-tasks modal">
							{#each selectedDayTasks.slice(0, 5) as task}
								<div
									class="day-task modal {task.id === selectedTask.id ? 'active' : ''}"
									on:click={() => (selectedTask = { ...task })}
									style="background-color: {task.priority === 'high'
										? '#e53e3e'
										: task.status === 'done'
											? '#48bb78'
											: task.status === 'inprogress'
												? '#ed8936'
												: '#4299e1'}"
								>
									<span>{task.title}</span>
									{#if task.tags && Array.isArray(task.tags) && task.tags.length > 0 && $tags && Array.isArray($tags)}
										<div class="tag-list-modal">
											{#each $tags.filter((tag) => task.tags.includes(tag.id)) as tag}
												<span class="tag-modal" style="background-color: {tag.color}"
													>{tag.name}</span
												>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
							{#if selectedDayTasks.length > 5}
								<div class="more-tasks">+{selectedDayTasks.length - 5} more</div>
							{/if}
						</div>
					</div>
				{/if}
			</div> -->
		</div>
	</div>
{/if}

{#if isTaskListModalOpen && selectedDay}
	<div class="modal-overlay" on:click={closeTaskListModal} transition:fade={{ duration: 150 }}>
		<div class="task-list-modal" on:click|stopPropagation>
			<h3>Tasks for {formatDateDisplay(selectedDay.date)}</h3>
			<div class="task-list">
				{#if selectedDayTasks && Array.isArray(selectedDayTasks)}
					{#each selectedDayTasks as task}
						<div
							class="task-list-item"
							on:click={() => openTaskDetails(task)}
							style="background-color: {task.priority === 'high'
								? '#e53e3e'
								: task.status === 'done'
									? '#48bb78'
									: task.status === 'inprogress'
										? '#ed8936'
										: '#4299e1'}"
						>
							<span class="task-title">{task.title}</span>
							{#if task.tags && Array.isArray(task.tags) && task.tags.length > 0 && $tags && Array.isArray($tags)}
								<div class="tag-list-small">
									{#each $tags.filter((tag) => task.tags.includes(tag.id)) as tag}
										<span class="tag-small" style="background-color: {tag.color}">{tag.name}</span>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
			<div class="task-list-actions">
				<button class="cancel-button" on:click={closeTaskListModal}>Close</button>
				<button
					class="save-button"
					on:click={() => {
						// Create a new task for this day
						selectedTask = {
							id: `local_${Date.now()}`,
							title: 'New Task',
							taskDescription: '',
							creationDate: new Date(),
							start_date: selectedDay ? new Date(selectedDay.date) : new Date(),
							due_date: selectedDay ? new Date(selectedDay.date) : new Date(),
							tags: [],
							attachments: [],
							project_id: currentProjectId || undefined,
							createdBy: get(currentUser)?.id,
							allocatedAgents: [],
							status: 'todo',
							priority: 'medium',
							prompt: '',
							context: '',
							task_outcome: '',
							dependencies: []
						};
						isTaskListModalOpen = false;
						isModalOpen = true;
						isEditingTitle = true;
					}}>Add New Task</button
				>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.task-calendar-container {
		height: auto;
		width: auto;
		display: flex;
		backdrop-filter: blur(10px);
		flex-direction: column;
		justify-content: flex-start;
		border-radius: 2rem;
		position: relative;
	}

	.spinner-container {
		position: fixed;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.view-controls {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		margin: 0 0.5rem;
		border: 1px solid #ddd;
		background-color: #f9f9f9;
		cursor: pointer;
		border-radius: 4px;
	}

	.toggle-btn.active {
		background-color: #4299e1;
		color: white;
		border-color: #4299e1;
	}

	.calendar-container {
		flex: 1;
		overflow: auto;
	}

	/* Month Group View Styles */
	.month-group-container {
		display: flex;
		overflow-x: auto;
		padding: 1rem;
		height: calc(100vh - 150px);
		gap: 1rem;
	}

	.month-column {
		min-width: 300px;
		max-width: 300px;
		background-color: #f1f5f9;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		padding: 1rem;
	}

	.month-header {
		text-align: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #cbd5e1;
	}

	.month-tasks {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.task-card {
		background-color: white;
		border-radius: 6px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.task-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.task-card h4 {
		margin-top: 0;
		margin-bottom: 0.5rem;
	}

	.description {
		font-size: 0.9rem;
		color: #64748b;
		margin-bottom: 0.5rem;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.tag-list-modal {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.tag {
		font-size: 0.9rem !important;
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		color: white;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		& span.tag-hidden {
			display: flex;
			font-size: 0.6rem;
		}
	}

	.tag-modal {
		padding: 0.5rem 1rem;
		font-size: 1.2rem;
		color: var(--text-color);
		border: 1px solid var(--line-color) !important;
		border-radius: 1rem;
		// opacity: 0.5;
		transition: all 0.3s ease;

		&:hover {
			opacity: 1;
			cursor: pointer;
		}
	}
	.tag-modal.selected {
		opacity: 1;
		font-weight: 800;
		box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
	}
	span.tag-modal {
		padding: 0.5rem;
	}
	.deadline {
		font-size: 0.8rem;
		color: #334155;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.task-status {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		display: inline-block;
	}

	.status-todo {
		background-color: #e0f2fe;
		color: #0284c7;
	}

	.status-inprogress {
		background-color: #ffedd5;
		color: #ea580c;
	}

	.status-done {
		background-color: #dcfce7;
		color: #16a34a;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		backdrop-filter: blur(20px);
		display: flex;
		justify-content: flex-end;
		align-items: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-container {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		width: 100%;
		&.form {
			background: var(--primary-color);
			border: 1px solid var(--bg-color);
			padding: 1rem;
			border-radius: 2rem;
			width: 100%;
		}
	}

	.modal-content {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		border-radius: 2rem;
		gap: 1rem;

		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.3);
		width: 100%;
		max-width: 400px;
		height: 100%;
		max-height: 600px;
		overflow-y: auto;
		overflow-x: hidden;

		& textarea {
			background: var(--primary-color);
			color: var(--text-color);
			resize: none;
			text-justify: center;
			border-bottom: 1px solid var(--line-color);

			&:focus {
				background: var(--secondary-color);
				border: 1px solid var(--line-color);
				border-radius: 1rem;
				outline: none;
				font-weight: 200;
				font-size: 1.3rem !important;
				max-height: 5rem;
			}
		}
	}

	.title-input {
		width: auto;
		font-size: 1.5rem;
		font-weight: 600;
		border-radius: 4px;
	}

	.description-section,
	.due-date-section,
	.tag-section {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
		display: flex;
		flex-direction: column;
		& p {
			font-size: 0.8rem;
			margin-bottom: 0.5rem;
			color: var(--placeholder-color);
		}
	}

	.status-section,
	.priority-section {
		padding: 0.5rem;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 0.5rem;
	}

	.status-control {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.description-section {
		transition: all 0.3s ease;

		& textarea {
			background: var(--bg-color);
			color: var(--text-color);
			resize: none;
			border-radius: 1rem;
			text-justify: center;
			transition: all 0.3s ease;
			height: auto;
			font-size: 0.8rem;

			// border: 1px solid var(--line-color);
			&:focus {
				width: auto;
				font-size: 0.8rem !important;
				text-justify: center;
				padding: 1rem;
				background: var(--secondary-color);
				border: 1px solid var(--line-color);
				outline: none;
				font-weight: 200;
				max-height: 10rem;
				display: flex;
				align-items: center;
			}
		}
	}

	.description-display {
		padding: 0 0.5rem;
		height: 2rem;
		display: flex;
		align-items: center;
		border: 1px solid var(--line-color);
		border-radius: 1rem;
		background: var(--bg-color);
		font-size: 0.8rem;
		cursor: text;
		transition: all 0.3s ease;
		&:hover {
			cursor: text;
			background: var(--secondary-color);
		}
	}

	.tag-section .tag-list {
		margin-top: 0.5rem;
	}

	.tag-section .tag {
		cursor: pointer;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.tag-section .tag.selected {
		opacity: 1;
	}

	.buttons {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 2rem;

		& span {
			display: flex;
			flex-direction: row;
			gap: 1rem;
		}
	}

	.save-button,
	.cancel-button,
	.delete-button {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.save-button {
		color: var(--primary-color);
		background: var(--tertiary-color);
		border: none;
	}

	.cancel-button {
		background: var(--secondary-color);
		border: none;
		color: var(--tertiary-color);
	}

	.delete-button {
		background-color: #ef4444;
		color: white;
		border: none;
	}
	.date-input-wrapper {
		position: relative;
		display: flex;
	}
	input.due[type='date'] {
		border-radius: 2rem;
		padding: 0 0.5rem;
		height: 2rem;
		width: 100%;
		font-size: 0.8rem;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background: var(--bg-color);

		&:hover {
			cursor: pointer;
			background: var(--secondary-color);
		}
	}
	.datepicker-input::-webkit-calendar-picker-indicator {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		cursor: pointer;
	}
	input.due[type='date']::-webkit-calendar-picker-indicator {
		opacity: 0;
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		cursor: pointer;
		z-index: 1;
	}
	.custom-calendar-icon {
		position: absolute;
		right: -1rem;
		top: 50%;
		display: none;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.25rem;
		transform: translateY(-50%);
		pointer-events: none; /* Let clicks pass through to the input */
		color: var(--text-color);
		z-index: 0;
	}
	select,
	input[type='date'] {
		padding: 1rem;
		border: 1px solid var(--line-color);
		background: var(--bg-color);
		color: var(--text-color);
		font-size: 0.8rem;
		width: auto;
	}
	@supports (-webkit-appearance: none) {
		select {
			-webkit-appearance: none;
			appearance: none;
			background: var(--secondary-color);
			background-size: 1.25rem !important;
			padding-right: 2.5rem;
		}
	}
	select {
		padding: 1rem;
		border: 1px solid var(--line-color);
		background: var(--bg-color);
		color: var(--text-color);
		font-size: 0.8rem;
		width: auto;
		border-radius: 2rem;
		transition: all 0.3s ease-in;
		&:hover {
			background: var(--secondary-color);
			cursor: pointer;
		}
	}

	/* Error styles */
	.error-message {
		padding: 1rem;
		margin-bottom: 1rem;
		background-color: #fee2e2;
		border-left: 4px solid #ef4444;
		color: #991b1b;
	}
	.view-controls {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	button.action-btn {
		display: flex;
		padding: 0.5rem 1rem;
		border-radius: 2rem;
		color: var(--text-color);
		border: none;
		font-size: 0.8rem;
		opacity: 0.5;
		transition: all 0.3s ease;
		&:hover {
			opacity: 1;
			cursor: pointer;
			&.save {
				background: var(--tertiary-color);
			}
			&.delete {
				background: red;
				& span {
					display: flex;
				}
			}
		}
		&.save {
			background: var(--secondary-color);
			&:hover {
				background: var(--tertiary-color);
			}
		}
		&.delete {
			gap: 1rem;
			background: transparent;
			& span {
				display: none;
			}
		}
		&.cancel {
			background: var(--secondary-color);
		}
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		margin: 0 0.5rem;
		border: 1px solid #ddd;
		background-color: #f9f9f9;
		cursor: pointer;
		border-radius: 4px;
	}

	.toggle-btn.active {
		background-color: #4299e1;
		color: white;
		border-color: #4299e1;
	}
	.calendar-header {
		display: flex;
		padding-inline-end: 1rem;
		padding-inline-start: 1rem;
		gap: 1rem;
		justify-content: flex-start;
		height: auto;
		width: auto;
		align-items: center;
	}
	.calendar-controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		& h3 {
			font-size: 0.8rem;
			margin: 0;
			padding: 0;
		}
	}
	h2 {
		border-bottom: 1px solid var(--line-color);
		padding: 1rem;
		transition: all 0.3s ease;
		font-size: 0.8rem;
		&:hover {
			border-radius: 1rem;
			cursor: text;
			background: var(--secondary-color);
		}
	}
	.calendar-controls button {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		background-color: #f9f9f9;
		cursor: pointer;
		border-radius: 4px;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		height: auto;
		gap: 0;
		margin: 0;
		padding: 0;
		border-collapse: collapse;
		background: var(--primary-color);
		border-radius: 2rem;
		overflow: hidden;
	}

	.weekday {
		padding: 0.5rem;
		text-align: center;
		font-weight: 600;
		color: var(--text-color);
	}

	.calendar-day {
		height: auto;
		width: auto;
		border: 1px solid var(--line-color);
		padding: 0.5rem;
		position: relative;
		cursor: pointer;
		margin: 0;
		box-sizing: border-box;
		overflow-x: hidden;
		overflow-y: auto;
	}

	.calendar-day:hover {
		background-color: var(--secondary-color);
	}

	.other-month {
		opacity: 0.5;
		border: 1px solid var(--secondary-color) !important;
	}

	.day-number {
		position: absolute;
		color: var(--text-color);
		top: 0.25rem;
		right: 0.25rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.day-number.current-date {
		background: var(--tertiary-color);
		color: var(--primary-color);
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: -4px 0 2px -4px;
	}
	.day-tasks-section {
		display: flex;
		margin-top: 1rem;
		flex-direction: column;
		padding: 0;
		justify-content: flex-start;
		align-items: flex-start;
	}
	.day-tasks {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		& span {
			font-size: 1rem;
		}
	}

	.day-task {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		width: auto;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.day-tasks.modal {
		padding: 0;
		gap: 0;
		display: flex;
		margin: 0;
		width: 100%;
		border-radius: 4px;
		font-size: 1.2rem;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.day-task.modal {
		padding: 1rem;
		border-radius: 1rem;
		font-size: 1.2rem;
		color: var(--text-color);
		gap: 1rem;
		display: flex;
		flex-direction: column;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.more-tasks {
		font-size: 0.75rem;
		color: #64748b;
		text-align: center;
	}
	.task-list-modal {
		background: var(--primary-color);
		border-radius: 8px;
		padding: 16px;
		width: 450px;
		max-width: 90vw;
		max-height: 80vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.task-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 60vh;
		overflow-y: auto;
	}

	.task-list-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-radius: 2rem;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--text-color);
		transition: all 0.3s ease;
	}

	.task-list-item .task-list-actions {
		display: flex;
		justify-content: space-between;
		margin-top: 16px;
	}
	.task-list-actions button {
		font-size: 1.3rem !important;
	}
	.task-title {
		font-weight: 500;
	}

	.tag-list-small {
		display: flex;
		gap: 4px;
	}

	.tag-small {
		font-size: 0.9rem;
		padding: 0.5rem;
		border-radius: 1rem;
		white-space: nowrap;
	}
	button.calendar-btn {
		background-color: var(--primary-color) !important;
		color: var(--text-color);
		font-size: 0.7rem;

		display: flex;
		justify-content: center;
		align-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0.5rem;
		border-radius: 50%;
		border: 1px solid transparent;
		border-radius: 2rem;
		transition: all 0.3s ease;

		&.today {
			width: auto;
			padding: 0.5rem 1rem;
			border-radius: 1rem;
			font-size: 0.9rem;
			letter-spacing: 0.2rem;
		}
		&:hover {
			background-color: var(--tertiary-color) !important;
			cursor: pointer;
		}
	}
	@media (max-width: 1000px) {
		.modal-content {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			border-radius: 2rem;
			gap: 1rem;
			padding: 2rem;
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.3);
			width: 100%;
			max-width: 800px;
			max-height: 90vh;
			overflow-y: auto;
			overflow-x: hidden;
		}
		.modal-container {
			display: flex;
			flex-direction: column;
			justify-content: center;
			width: 100%;

			&.form {
				background: transparent;
				border: 1px solid transparent;
				padding: 0;
				border-radius: 2rem;
			}
		}
		.calendar-controls {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 1rem;
		}

		.calendar-controls button {
			padding: 0.5rem 1rem;
			border: 1px solid #ddd;
			background-color: #f9f9f9;
			cursor: pointer;
			border-radius: 4px;
		}

		.calendar-grid {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			height: auto;
			gap: 0;
			margin: 0;
			padding: 0;
			border-collapse: collapse;
		}

		.weekday {
			background: var(--primary-color);
			padding: 0.5rem;
			text-align: center;
			font-weight: 600;
			color: var(--text-color);
		}

		.calendar-day {
			height: 80px;
			background: var(--primary-color);
			border: 1px solid transparent;
			border-bottom: 1px solid var(--line-color);
			padding: 0.5rem;
			position: relative;
			cursor: pointer;
			margin: 0;
			box-sizing: border-box;
		}

		.calendar-day:hover {
			background-color: var(--secondary-color);
		}

		.other-month {
			background-color: var(--secondary-color);
			border-bottom: 1px solid var(--line-color) !important;
		}

		.day-tasks {
			margin-top: 1.5rem;
			display: flex;
			flex-direction: row;
			gap: 0.25rem;

			& span {
				display: none;
			}
		}
		.day-tasks.modal {
			margin-top: 1.5rem;
			display: flex;
			flex-direction: column;
			width: 100%;

			& span {
				display: flex;
			}
		}

		.day-task {
			padding: 0.25rem 0.5rem;
			border-radius: 4px;
			font-size: 0.75rem;
			color: white;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.day-task-modal {
			display: flex;
			padding: 0.25rem 0.5rem;
			border-radius: 4px;
			font-size: 0.75rem;
			color: white;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;

			& span {
				display: flex;
			}
		}
		.more-tasks {
			font-size: 0.75rem;
			color: #64748b;
			text-align: center;
		}
		.calendar-header {
			display: flex;
			align-items: center;
		}
		.calendar-controls {
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			& h3 {
				text-align: center;
				padding: 0;
				margin: 0;
				width: auto;
				font-size: 1rem;
			}
		}
		button.calendar-btn {
			background-color: var(--primary-color) !important;
			color: var(--text-color);
			font-size: 1rem;

			display: flex;
			justify-content: center;
			align-items: center;
			width: 2rem;
			height: 2rem;
			padding: 0.5rem;
			border-radius: 50%;
			border: 1px solid transparent;
			border-radius: 2rem;
			&.today {
				width: auto;
				padding: 0.5rem;
				border-radius: 1rem;
				font-size: 0.8rem;
			}
			&:hover {
				background-color: var(--tertiary-color);
				cursor: pointer;
			}
		}
	}
	@media (max-width: 768px) {
		.calendar-header {
			width: 100%;
			margin: 0;
			justify-content: center;
		}
	}
	@media (max-width: 450px) {
		.calendar-header {
			display: flex;
			flex-direction: row;
			justify-content: center;
			padding: 0.5rem;
			align-items: center;
			width: 100%;
			margin: 0;
		}
		.calendar-controls {
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			& h3 {
				text-align: center;
				padding: 0;
				margin: 0;
				width: auto;
				font-size: 1.1rem !important;
			}
		}
	}
</style>
