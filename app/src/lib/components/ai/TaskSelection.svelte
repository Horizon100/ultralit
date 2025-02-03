<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types/types';
	import { networkStore } from '$lib/stores/networkStore';

	export let tasks: Task[];

	const dispatch = createEventDispatcher<{
		select: Task[];
	}>();

	let selectedTasks: Task[] = [];

	function handleSelect(task: Task) {
		const index = selectedTasks.findIndex((t) => t.id === task.id);
		if (index === -1) {
			selectedTasks = [...selectedTasks, task];
		} else {
			selectedTasks = selectedTasks.filter((t) => t.id !== task.id);
		}
	}

	function handleSubmit() {
		selectedTasks.forEach((task) => networkStore.addTask(task));
		dispatch('select', selectedTasks);
	}
</script>

<div class="task-selection">
	<h2>Select Tasks</h2>
	<div class="tasks">
		{#each tasks as task (task.id)}
			<label class="task-checkbox">
				<input
					type="checkbox"
					on:change={() => handleSelect(task)}
					checked={selectedTasks.some((t) => t.id === task.id)}
				/>
				{task.description}
			</label>
		{/each}
	</div>
	<button class="submit-button" on:click={handleSubmit} disabled={selectedTasks.length === 0}>
		Submit Selected Tasks
	</button>
</div>

<style>
	.task-selection {
		margin-bottom: 20px;
	}

	h2 {
		font-size: 1.5em;
		margin-bottom: 10px;
	}

	.tasks {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.task-checkbox {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.submit-button {
		margin-top: 10px;
		padding: 10px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.submit-button:hover:not(:disabled) {
		background-color: #45a049;
	}

	.submit-button:disabled {
		background-color: #cccccc;
		cursor: not-allowed;
	}
</style>
