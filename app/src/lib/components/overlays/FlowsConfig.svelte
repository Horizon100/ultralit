<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Plus, Trash2 } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import type { Workflows } from '$lib/types/types';
	import { flowStore } from '$lib/stores/flowStore';
	import { currentUser } from '$lib/pocketbase';
	import { createFlow, updateFlow, deleteFlow } from '$lib/clients/flowClient';

	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';

	let showCreateForm = false;
	let selectedFlow: Workflows | null = null;
	let flows: Workflows[] = [];
	let updateStatus = '';
	let isLoading = true;
	let loadError = ''; // Add this line

	// Form fields
	let flowName = '';
	let flowDescription = '';
	let flowSummary: string[] = [];

	onMount(async () => {
		showLoading();
		if ($currentUser && $currentUser.id) {
			try {
				await flowStore.loadFlows($currentUser.id);
			} catch (error) {
				console.error('Error loading flows:', error);
				loadError = 'Failed to load flows. Please try again.';
			}
		}
		isLoading = false;
		hideLoading();
	});

	const unsubscribe = flowStore.subscribe((state) => {
		flows = state.flows;
		updateStatus = state.updateStatus;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function showCreate() {
		showCreateForm = true;
		selectedFlow = null;
		resetForm();
	}

	function showEdit(flow: Workflows) {
		selectedFlow = flow;
		flowName = flow.name;
		flowDescription = flow.description;
		flowSummary = flow.summary;
		showCreateForm = true;
	}

	function resetForm() {
		flowName = '';
		flowDescription = '';
		flowSummary = [];
	}

	function handleCancel() {
		showCreateForm = false;
		selectedFlow = null;
		resetForm();
	}

	async function handleSubmit() {
		const flowData: Workflows = {
			id: selectedFlow?.id ?? '', // Provide a default empty string
			name: flowName,
			description: flowDescription,
			summary: flowSummary,
			user_id: $currentUser?.id ?? '', // Provide a default empty string
			created: selectedFlow?.created ?? new Date().toISOString(),
			updated: new Date().toISOString()
		};

		try {
			if (selectedFlow) {
				const updatedFlow = await updateFlow(selectedFlow.id, flowData);
				flowStore.updateFlow(selectedFlow.id, updatedFlow);
			} else {
				const newFlow = await createFlow(flowData);
				flowStore.addFlow(newFlow);
			}
			showCreateForm = false;
			selectedFlow = null;
			resetForm();
		} catch (error) {
			console.error('Error saving flow:', error);
			updateStatus = 'Error saving flow. Please try again.';
		}
	}
	async function handleDelete(flow: Workflows) {
		if (confirm(`Are you sure you want to delete ${flow.name}?`)) {
			try {
				await deleteFlow(flow.id);
				flowStore.removeFlow(flow.id);
			} catch (error) {
				console.error('Error deleting flow:', error);
				updateStatus = 'Error deleting flow. Please try again.';
			}
		}
	}

	function addSummaryItem() {
		flowSummary = [...flowSummary, ''];
	}

	function removeSummaryItem(index: number) {
		flowSummary = flowSummary.filter((_, i) => i !== index);
	}
</script>

<div class="flows-config">
	<div class="column flows-column">
		<div class="container-row">
			<h2>Flows</h2>
			{#if !showCreateForm}
				<button class="create-button" on:click={showCreate}>
					<Plus size={24} />
				</button>
			{/if}
		</div>
		<hr />
		<p>Configure your workflows.</p>

		{#if isLoading}
			<LoadingSpinner />
		{:else if flows.length === 0}
			<p>No flows found. Create a new flow to get started.</p>
		{:else}
			<div class="button-grid">
				{#each flows as flow (flow.id)}
					<div class="flow-item">
						<button class="item" on:click={() => showEdit(flow)}>
							{flow.name}
						</button>
						<button class="delete-button" on:click={() => handleDelete(flow)}>
							<Trash2 size={24} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showCreateForm}
		<div class="column form-column" transition:fly={{ x: 300, duration: 300 }}>
			<div class="form-content">
				<h3>{selectedFlow ? 'Edit Flow' : 'Create New Flow'}</h3>

				<div class="form-group">
					<label for="flowName">Flow Name</label>
					<input type="text" id="flowName" bind:value={flowName} placeholder="Enter flow name..." />
				</div>

				<div class="form-group">
					<label for="flowDescription">Description</label>
					<textarea
						id="flowDescription"
						bind:value={flowDescription}
						placeholder="Enter flow description..."
					></textarea>
				</div>

				<div class="form-group">
					<label>Summary</label>
					{#if Array.isArray(flowSummary)}
						{#each flowSummary as item, index}
							<div class="summary-item">
								<input
									type="text"
									bind:value={flowSummary[index]}
									placeholder="Enter summary item..."
								/>
								<button class="remove-button" on:click={() => removeSummaryItem(index)}
									>Remove</button
								>
							</div>
						{/each}
					{/if}
					<button class="add-button" on:click={addSummaryItem}>Add Summary Item</button>
				</div>
			</div>

			<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>Cancel</button>
				<button class="submit-button" on:click={handleSubmit}>
					{selectedFlow ? 'Update' : 'Create'}
				</button>
			</div>
		</div>
	{/if}
</div>

{#if updateStatus}
	<div class="update-status" transition:fade>
		<LoadingSpinner />
		{updateStatus}
	</div>
{/if}

<style>
	.flows-config {
		display: flex;
		gap: 20px;
		/* height: 100%; */
		overflow: hidden;
		/* width: 97%; */
		height: auto;
		/* border-radius: 30px; */
		/* border-bottom-left-radius: 20px;  */
		/* border-bottom-right-radius: 20px; */
		border-top: 5px solid #262929;
		border-bottom: 20px solid #262929;
		border-left: 5px solid #262929;
		border-right: 20px solid #262929;
		background: linear-gradient(145deg, #363f3f, #1a1a1a);
		justify-content: center;
		align-items: center;
	}

	.column {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 500px;
		justify-content: flex-start;
	}

	.flows-column {
		overflow-y: auto;
		justify-content: flex-start;
		display: flex;
		padding: 10px;
		height: 86vh;
		/* width: 50%; */
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: white transparent;
		background-color: transparent;
	}

	.form-column {
		display: flex;
		flex-direction: column;
		padding: 20px;
		height: 90%;
		width: 50vh;
	}

	.form-content {
		flex-grow: 1;
		overflow: hidden;
	}

	.form-group {
		margin-bottom: 20px;
	}

	label {
		display: flex;
		align-items: center;
		font-weight: bold;
		margin-bottom: 5px;
		color: #555;
	}

	input[type='text'],
	input[type='password'],
	textarea,
	select {
		width: 100%;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 16px;
	}

	textarea {
		height: 100px;
		resize: vertical;
	}

	.button-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		margin-top: 20px;
	}

	.button-group {
		display: flex;
		flex-direction: row;
		gap: 10px;
		margin-top: 20px;
		width: 100%;
	}

	button {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		padding: 20px 20px;
		border: none;
		gap: 5px;
		margin-bottom: 20px;
		border-radius: 4px;
		width: 100%;
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.cancel-button {
		background-color: #ccc;
		color: #333;
	}

	.cancel-button:hover {
		background-color: #bbb;
	}

	.submit-button {
		background-color: #4caf50;
		color: white;
	}

	.submit-button:hover {
		background-color: #45a049;
	}

	.create-button {
		background-color: #4caf50;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20px;
		width: 50px; /* or set to auto if button should fit the icon */
		height: 50px; /* Ensure button height is consistent */
		border: none; /* Optional */
		padding: 0; /* Remove any padding if not needed */
	}

	.create-button:hover {
		background-color: #45a049;
	}

	.container-row {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}

	.item {
		background-color: transparent;
		color: #ffffff;
		height: 50px;
		transition: transform 1.8s cubic-bezier(0.075, 0.82, 0.165, 1);
		margin-right: 10px;
		display: flex;
		align-items: left;
		justify-content: left;
	}

	.item:hover {
		background-color: #e0e0e0;
		transform: scale(1.05);
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
		color: black;
	}

	.agent-item {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		border-bottom: 2px solid rgb(84, 84, 84);
	}

	.delete-button {
		background-color: transparent;
		color: white;
		padding: 0;
		border: none;
		border-radius: 0px;
		cursor: pointer;
		height: 50px;
		width: 50px;

		transition: background-color 0.3s;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}

	.delete-button:hover {
		background-color: #ff0000;
	}

	.update-status {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background-color: #4caf50;
		color: white;
		padding: 10px 20px;
		border-radius: 4px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	hr {
		border: 0;
		border-top: 2px solid rgb(84, 84, 84);
		margin: 0;
	}

	.error-message {
		color: #ff6b6b;
		font-weight: bold;
		margin-top: 1rem;
	}
</style>
