<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { Actions } from '$lib/types/types';
	import { actionStore } from '$lib/stores/actionStore';
	import { currentUser } from '$lib/pocketbase';
	import {
		createAction,
		updateAction,
		deleteAction,
		fetchActions
	} from '$lib/clients/actionClient';
	import { browser } from '$app/environment';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';

	let showCreateForm = false;
	let selectedAction: Actions | null = null;
	let actions: Actions[] = [];
	let updateStatus = '';
	let isLoading = true;

	// Form fields
	let actionsName = '';
	let actionsDescription = '';
	let actionsCode = '';

	function debugCookies() {
		if (browser) {
			console.log('Document cookies:', document.cookie);
			console.log('Current user:', $currentUser);
		}
	}
	onMount(async () => {
		debugCookies();
		showLoading();
		await actionStore.loadActions();

		isLoading = false;
	});

	const unsubscribe = actionStore.subscribe((state) => {
		actions = state.actions || [];
		updateStatus = state.updateStatus;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function showCreate() {
		showCreateForm = true;
		selectedAction = null;
		resetForm();
	}

	function showEdit(action: Actions) {
		selectedAction = action;
		actionsName = action.name;
		actionsDescription = action.description;
		actionsCode = action.code;
		showCreateForm = true;
	}

	function resetForm() {
		actionsName = '';
		actionsDescription = '';
		actionsCode = '';
	}

	function handleCancel() {
		showCreateForm = false;
		selectedAction = null;
		resetForm();
	}

	async function handleSubmit() {
		const actionData: Partial<Actions> = {
			name: actionsName,
			description: actionsDescription,
			code: actionsCode
		};

		try {
			if (selectedAction) {
				// Use the store method (it handles both API and store update)
				await actionStore.updateAction(selectedAction.id, actionData);
			} else {
				// Use the store method (it handles both API and store update)
				await actionStore.addAction(actionData);
			}
			showCreateForm = false;
			selectedAction = null;
			resetForm();
		} catch (error) {
			console.error('Error saving action:', error);
			updateStatus = 'Error saving action. Please try again.';
		}
	}

	async function handleDelete(action: Actions) {
		if (confirm(`Are you sure you want to delete ${action.name}?`)) {
			try {
				await deleteAction(action.id);
				actionStore.removeAction(action.id);
			} catch (error) {
				console.error('Error deleting action:', error);
				updateStatus = 'Error deleting action. Please try again.';
			}
		}
	}
</script>

<div class="actions-config">
	<div class="column actions-column">
		<div class="container-row">
			<h2>Actions</h2>
			{#if !showCreateForm}
				<button class="create-button" on:click={showCreate}>
					<Icon name="Plus" size={24} />
				</button>
			{/if}
		</div>
		<hr />

		<p>Configure your actions.</p>

		{#if isLoading}
			<LoadingSpinner />
		{:else if actions.length === 0}
			<p>No actions found. Create a new action to get started.</p>
		{:else}
			<div class="button-grid">
				{#each actions as action (action.id)}
					<div class="action-item">
						<button class="item" on:click={() => showEdit(action)}>
							{action.name}
						</button>
						<button class="delete-button" on:click={() => handleDelete(action)}>
							<Icon name="Trash2" size={24} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showCreateForm}
		<div class="column form-column" transition:fly={{ x: 300, duration: 300 }}>
			<div class="form-content">
				<h3>{selectedAction ? 'Edit Action' : 'Create New Action'}</h3>

				<div class="form-group">
					<label for="actionName">Action Name</label>
					<input
						type="text"
						id="actionName"
						bind:value={actionsName}
						placeholder="Enter action name..."
					/>
				</div>

				<div class="form-group">
					<label for="actionDescription">Description</label>
					<textarea
						id="actionDescription"
						bind:value={actionsDescription}
						placeholder="Enter action description..."
					></textarea>
				</div>

				<div class="form-group">
					<label for="actionCode">Code</label>
					<textarea id="actionCode" bind:value={actionsCode} placeholder="Enter action code..."
					></textarea>
				</div>
			</div>

			<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>Cancel</button>
				<button class="submit-button" on:click={handleSubmit}>
					{selectedAction ? 'Update' : 'Create'}
				</button>
			</div>
		</div>
	{/if}
</div>

{#if updateStatus}
	<div class="update-status" transition:fade>
		{updateStatus}
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.actions-config {
		display: flex;
		gap: 0;
		overflow: hidden;
		height: 92vh;
		z-index: 1000;
		width: 100%;
		backdrop-filter: blur(20px);
	}

	.column {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 500px;
		justify-content: flex-start;
	}

	.actions-column {
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
		height: 95%;
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
		margin-right: 5rem;
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

	.action-item {
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
</style>
