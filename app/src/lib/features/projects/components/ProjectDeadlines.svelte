<script lang="ts">
	import { onMount } from 'svelte';
	import { projectStore } from '$lib/stores/projectStore';
	import { currentUser } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { get } from 'svelte/store';
	import { loadProjectTasks } from '$lib/clients/taskClient';
	import { fade, slide } from 'svelte/transition';
	import { Calendar, Clock, Flag, User, ChevronRight } from 'lucide-svelte';
	import type { KanbanTask, Projects } from '$lib/types/types';

	export let projectId: string;

	let tasks: KanbanTask[] = [];
	let isLoading = false;
	let error = '';

	// Reactive properties with filtering
	$: filteredTasks = tasks.filter((task) =>
		['done', 'todo', 'review', 'delegate'].includes(task.status)
	);

	$: sortedTasks = filteredTasks.sort((a, b) => {
		// Tasks with due_date come first, sorted by due date
		if (a.due_date && b.due_date) {
			return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
		}
		// Tasks with due_date come before tasks without due_date
		if (a.due_date && !b.due_date) return -1;
		if (!a.due_date && b.due_date) return 1;
		// If both have no due_date, sort by creation date (newest first)
		return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
	});

	// Load tasks for the project
	async function loadTasks() {
		if (!projectId) return;

		isLoading = true;
		error = '';

		try {
			tasks = await loadProjectTasks(projectId);
		} catch (err) {
			console.error('Error loading project tasks:', err);
			error = err instanceof Error ? err.message : 'Failed to load tasks';
			tasks = [];
		} finally {
			isLoading = false;
		}
	}

	// Format date display
	function formatDate(date: Date | null): string {
		if (!date) return '';
		try {
			const d = new Date(date);
			const now = new Date();
			const diffTime = d.getTime() - now.getTime();
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

			if (diffDays === 0) return 'Today';
			if (diffDays === 1) return 'Tomorrow';
			if (diffDays === -1) return 'Yesterday';
			if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
			if (diffDays <= 7) return `${diffDays} days`;

			return d.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
			});
		} catch (e) {
			return 'Invalid date';
		}
	}

	// Get priority color class
	function getPriorityClass(priority: string): string {
		switch (priority?.toLowerCase()) {
			case 'high':
				return 'priority-high';
			case 'medium':
				return 'priority-medium';
			case 'low':
				return 'priority-low';
			default:
				return 'priority-none';
		}
	}

	// Get status display name
	function getStatusDisplay(status: string): string {
		const statusMap: Record<string, string> = {
			todo: 'To Do',
			done: 'Done',
			review: 'Review',
			delegate: 'Delegate'
		};
		return statusMap[status] || status;
	}

	// Check if task is overdue
	function isOverdue(dueDate: Date | null): boolean {
		if (!dueDate) return false;
		return (
			new Date(dueDate) < new Date() &&
			new Date(dueDate).toDateString() !== new Date().toDateString()
		);
	}

	// Handle task click - emit event for parent component to handle
	function handleTaskClick(task: KanbanTask) {
		// Create a custom event that the parent component can listen to
		const event = new CustomEvent('taskClick', {
			detail: task
		});
		// Dispatch the event
		document.dispatchEvent(event);
	}

	// Load tasks when component mounts or projectId changes
	$: if (projectId) {
		loadTasks();
	}

	onMount(() => {
		if (projectId) {
			loadTasks();
		}
	});
</script>

<div class="project-deadlines">
	<div class="header">
		<!-- <h3>{$t('dashboard.projectDeadlines')}</h3> -->
		{#if filteredTasks.length > 0}
			<span class="task-count"
				>{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}</span
			>
		{/if}
	</div>

	{#if isLoading}
		<div class="loading" transition:fade>
			<div class="spinner"></div>
			<p>Loading tasks...</p>
		</div>
	{:else if error}
		<div class="error" transition:fade>
			<p>Error: {error}</p>
			<button on:click={loadTasks} class="retry-btn">Retry</button>
		</div>
	{:else if sortedTasks.length === 0}
		<div class="empty-state" transition:fade>
			<Calendar size={48} strokeWidth={1.5} />
			<p>No tasks found for this project</p>
			<span class="sub-text">Tasks will appear here once they're created</span>
		</div>
	{:else}
		<div class="tasks-list" transition:slide>
			{#each sortedTasks as task (task.id)}
				<div
					class="task-item {getPriorityClass(task.priority)}"
					class:overdue={isOverdue(task.due_date)}
					on:click={() => handleTaskClick(task)}
					on:keydown={(e) => e.key === 'Enter' && handleTaskClick(task)}
					role="button"
					tabindex="0"
					transition:slide={{ duration: 200 }}
				>
					<div class="task-content">
						<div class="task-header">
							<h4 class="task-title">{task.title}</h4>
							<span class="status-badge {task.status}">{getStatusDisplay(task.status)}</span>
						</div>

						{#if task.taskDescription}
							<p class="task-description">{task.taskDescription}</p>
						{/if}

						<div class="task-meta">
							{#if task.due_date}
								<span class="due-date" class:overdue={isOverdue(task.due_date)}>
									<Clock size={14} />
									{formatDate(task.due_date)}
								</span>
							{:else}
								<span class="no-due-date">
									<Clock size={14} />
									No deadline
								</span>
							{/if}

							{#if task.priority && task.priority !== 'low'}
								<span class="priority-indicator {getPriorityClass(task.priority)}">
									<Flag size={14} />
									{task.priority}
								</span>
							{/if}

							{#if task.assignedTo}
								<span class="assigned-to">
									<User size={14} />
									Assigned
								</span>
							{/if}
						</div>
					</div>

					<ChevronRight size={16} class="chevron" />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.project-deadlines {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		width: 100%;
		margin-top: 1rem;
	}

	.header {
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}

	.header h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0;
		color: var(--text-primary);
	}

	.task-count {
		font-size: 1.5rem;
		color: var(--text-secondary);
		background: var(--background-tertiary);
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
	}

	.loading,
	.error,
	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--text-secondary);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border-color);
		border-top: 2px solid var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.retry-btn {
		background: var(--accent-primary);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		margin-top: 0.5rem;
		transition: background-color 0.2s;
	}

	.retry-btn:hover {
		background: var(--accent-primary-dark);
	}

	.empty-state :global(svg) {
		color: var(--text-tertiary);
		margin-bottom: 1rem;
	}

	.sub-text {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	.tasks-list {
		display: flex;
		flex-direction: column;
	}

	.task-item {
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.task-item:hover {
		background: var(--primary-color);
		border-color: var(--border-hover);
		transform: translateY(-1px);
	}

	.task-item.overdue {
		border-left: 3px solid var(--error-color);
	}

	.task-content {
		flex: 1;
	}

	.task-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.task-title {
		font-size: 1rem;
		font-weight: 500;
		margin: 0;
		color: var(--text-primary);
		flex: 1;
		margin-right: 1rem;
	}

	.status-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.status-badge.todo {
		background: var(--status-todo-bg);
		color: var(--status-todo-text);
	}

	.status-badge.inprogress {
		background: var(--status-progress-bg);
		color: var(--status-progress-text);
	}

	.status-badge.done {
		background: var(--status-done-bg);
		color: var(--status-done-text);
	}

	.status-badge.hold {
		background: var(--status-hold-bg);
		color: var(--status-hold-text);
	}

	.status-badge.review {
		background: var(--status-review-bg);
		color: var(--status-review-text);
	}

	.status-badge.delegate {
		background: var(--status-delegate-bg);
		color: var(--status-delegate-text);
	}

	p.task-description {
		display: none !important;
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0 0 0.75rem 0;
		line-height: 1.4;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.task-meta {
		display: flex;
		gap: 1rem;
		align-items: center;
		font-size: 0.875rem;
	}

	.due-date,
	.no-due-date,
	.priority-indicator,
	.assigned-to {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--text-secondary);
	}

	.due-date.overdue {
		color: var(--error-color);
		font-weight: 500;
	}

	.priority-indicator.priority-high {
		color: var(--error-color);
	}

	.priority-indicator.priority-medium {
		color: var(--warning-color);
	}

	.priority-indicator.priority-low {
		color: var(--success-color);
	}

	.chevron {
		color: var(--text-tertiary);
		transition: transform 0.2s;
	}

	.task-item:hover .chevron {
		transform: translateX(2px);
		color: var(--text-secondary);
	}

	/* Priority border indicators */
	.task-item.priority-high {
		border-left: 3px solid var(--error-color);
	}

	.task-item.priority-medium {
		border-left: 3px solid var(--warning-color);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.task-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.task-title {
			margin-right: 0;
		}

		.task-meta {
			flex-wrap: wrap;
			gap: 0.5rem;
		}
	}
</style>
