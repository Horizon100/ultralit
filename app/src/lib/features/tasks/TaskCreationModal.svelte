<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { KanbanTask, Tag as TagType } from '$lib/types/types';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let messageContent: string = '';
	export let promptContent: string = '';
	export let tags: TagType[] = [];
	export let showModal: boolean = false;
	export let threadId: string = '';
	export let messageId: string = '';

	const dispatch = createEventDispatcher();

	let task: Partial<KanbanTask> = {
		title: '',
		taskDescription: messageContent,
		due_date: null,
		tags: [],
		status: 'todo',
		priority: 'medium',
		prompt: promptContent,
		agentMessages: [messageId]
	};

	let selectedPriority = 'medium';
	let isSubmitting = false;
	let selectedDeadline: string | null = null;

	// When modal opens, extract a potential title from the first sentence
	$: if (showModal && messageContent) {
		// Extract first sentence or first 50 chars for title
		let firstSentence = messageContent.split('.')[0].trim();
		if (firstSentence.length > 50) {
			firstSentence = firstSentence.substring(0, 47) + '...';
		}
		task.title = firstSentence;
	}

	function closeModal() {
		showModal = false;
	}

	function setQuickDeadline(days: number) {
		const deadline = new Date();
		deadline.setDate(deadline.getDate() + days);
		task.due_date = deadline;
		selectedDeadline = days.toString();
	}

	function setEndOfWeekDeadline() {
		const deadline = new Date();
		const daysUntilEndOfWeek = 5 - deadline.getDay(); // Friday is 5
		deadline.setDate(
			deadline.getDate() + (daysUntilEndOfWeek <= 0 ? daysUntilEndOfWeek + 7 : daysUntilEndOfWeek)
		);
		task.due_date = deadline;
		selectedDeadline = 'endOfWeek';
	}

	function toggleTag(tagId: string) {
		const tagIndex = task.tags?.indexOf(tagId) ?? -1;
		if (tagIndex === -1) {
			task.tags = [...(task.tags || []), tagId];
		} else {
			task.tags = task.tags?.filter((id) => id !== tagId) || [];
		}
	}

	function setPriority(priority: 'high' | 'medium' | 'low') {
		task.priority = priority;
		selectedPriority = priority;
	}

	async function submitTask() {
		if (!task.title?.trim()) {
			return;
		}

		isSubmitting = true;

		const result = await clientTryCatch(
			(async () => {
				dispatch('save', task);

				// Close the modal
				closeModal();

				return true;
			})(),
			`Submitting task "${task.title}"`
		);

		if (isFailure(result)) {
			console.error('Error creating task:', result.error);
			dispatch('error', { message: 'Failed to create task' });
		}

		// Always reset submitting state
		isSubmitting = false;
	}
</script>

{#if showModal}
	<div class="modal-backdrop" transition:fade={{ duration: 150 }} on:click|self={closeModal}>
		<div class="modal-container" transition:fly={{ y: 20, duration: 200 }}>
			<div class="modal-header">
				<h3>
					<Icon name="ListTodo" size={20} />
					Create Task from Message
				</h3>
				<button class="close-btn" on:click={closeModal}>
					<Icon name="X" size={20} />
				</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="task-title">Task Title</label>
					<input
						type="text"
						id="task-title"
						bind:value={task.title}
						placeholder="Enter task title"
						class="form-control"
					/>
				</div>

				<div class="form-group">
					<label for="task-description">Task Description</label>
					<textarea
						id="task-description"
						bind:value={task.taskDescription}
						placeholder="Task description"
						class="form-control"
						rows="5"
					></textarea>
				</div>

				<div class="form-group">
					<label>
						<Icon name="Calendar" size={16} />
						Set Deadline
					</label>
					<div class="deadline-buttons">
						<button class:selected={selectedDeadline === '1'} on:click={() => setQuickDeadline(1)}>
							Tomorrow
						</button>
						<button class:selected={selectedDeadline === '3'} on:click={() => setQuickDeadline(3)}>
							3 Days
						</button>
						<button class:selected={selectedDeadline === '7'} on:click={() => setQuickDeadline(7)}>
							1 Week
						</button>
						<button
							class:selected={selectedDeadline === 'endOfWeek'}
							on:click={setEndOfWeekDeadline}
						>
							This Friday
						</button>
					</div>

					{#if task.due_date}
						<div class="selected-date">
							Due: {task.due_date.toLocaleDateString()}
							<button
								class="clear-date"
								on:click={() => {
									task.due_date = null;
									selectedDeadline = null;
								}}>×</button
							>
						</div>
					{/if}
				</div>

				<div class="form-group">
					<label>
						<Icon name="CheckSquare" size={16} />
						Priority
					</label>
					<div class="priority-buttons">
						<button
							class="priority-btn high"
							class:selected={selectedPriority === 'high'}
							on:click={() => setPriority('high')}
						>
							High
						</button>
						<button
							class="priority-btn medium"
							class:selected={selectedPriority === 'medium'}
							on:click={() => setPriority('medium')}
						>
							Medium
						</button>
						<button
							class="priority-btn low"
							class:selected={selectedPriority === 'low'}
							on:click={() => setPriority('low')}
						>
							Low
						</button>
					</div>
				</div>

				{#if tags && tags.length > 0}
					<div class="form-group">
						<label>
							<Icon name="Tag" size={16} />
							Tags
						</label>
						<div class="tags-container">
							{#each tags as tag}
								<button
									class="tag-button"
									class:selected={task.tags?.includes(tag.id)}
									style="--tag-color: {tag.color || '#6c757d'}"
									on:click={() => toggleTag(tag.id)}
								>
									{tag.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="cancel-btn" on:click={closeModal} disabled={isSubmitting}>Cancel</button>
				<button class="save-btn" on:click={submitTask} disabled={!task.title || isSubmitting}>
					{isSubmitting ? 'Creating...' : 'Create Task'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-container {
		background-color: var(--surface-color, #fff);
		border-radius: 8px;
		width: 90%;
		max-width: 550px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color, #e5e5e5);
	}

	.modal-header h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-secondary, #6c757d);
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		background-color: var(--surface-hover, #f5f5f5);
		color: var(--text-primary, #212529);
	}

	.modal-body {
		padding: 20px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		margin-bottom: 8px;
		color: var(--text-secondary, #6c757d);
	}
</style>
