<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { AIModel, User } from '$lib/types/types';
	import { modelStore } from '$lib/stores/modelStore';
	import { currentUser } from '$lib/pocketbase';
	import { createModel, updateModel, deleteModel } from '$lib/clients/modelClient';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';

	let showCreateForm = false;
	let selectedModel: AIModel | null = null;
	let models: AIModel[] = [];
	let updateStatus = '';
	let isLoading = true;

	// Form fields
	let modelName = '';
	let modelDescription = '';
	let modelApiKey = '';
	let modelBaseUrl = '';
	let modelApiType: AIModel['api_type'] = 'gpt-3.5-turbo';
	let modelApiVersion = '';

	const apiTypes: AIModel['api_type'][] = ['gpt-3.5-turbo', 'gpt-4', 'claude-v1', 'other-model'];

	onMount(async () => {
		showLoading();
		if ($currentUser && $currentUser.id) {
			await modelStore.loadModels($currentUser.id);
		}
		isLoading = false;
	});

	const unsubscribe = modelStore.subscribe((state) => {
		models = state.models;
		updateStatus = state.updateStatus;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function showCreate() {
		showCreateForm = true;
		selectedModel = null;
		resetForm();
	}

	function showEdit(model: AIModel) {
		selectedModel = model;
		modelName = model.name;
		modelDescription = model.description;
		modelApiKey = model.api_key;
		modelBaseUrl = model.base_url;
		modelApiType = model.api_type;
		modelApiVersion = model.api_version;
		showCreateForm = true;
	}

	function resetForm() {
		modelName = '';
		modelDescription = '';
		modelApiKey = '';
		modelBaseUrl = '';
		modelApiType = 'gpt-3.5-turbo';
		modelApiVersion = '';
	}

	function handleCancel() {
		showCreateForm = false;
		selectedModel = null;
		resetForm();
	}

	async function handleSubmit() {
		if (!$currentUser) {
			updateStatus = 'User not authenticated';
			return;
		}
		const modelData: Partial<AIModel> = {
			name: modelName,
			description: modelDescription,
			api_key: modelApiKey,
			base_url: modelBaseUrl,
			api_type: modelApiType,
			api_version: modelApiVersion,
			user: [$currentUser.id],
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};

		try {
			if (selectedModel) {
				const result = await updateModel(selectedModel.id, modelData);
				if (result.success) {
					modelStore.updateModel(selectedModel.id, result.data);
				} else {
					throw new Error(result.error);
				}
			} else {
				const result = await createModel(modelData, $currentUser.id);
				if (result.success) {
					modelStore.addModel(result.data);
				} else {
					throw new Error(result.error);
				}
			}
			showCreateForm = false;
			selectedModel = null;
			resetForm();
		} catch (error) {
			console.error('Error saving model:', error);
			updateStatus =
				error instanceof Error ? error.message : 'Error saving model. Please try again.';
		}
	}

	async function handleDelete(model: AIModel) {
		if (confirm(`Are you sure you want to delete ${model.name}?`)) {
			try {
				await deleteModel(model.id);
				modelStore.removeModel(model.id);
			} catch (error) {
				console.error('Error deleting model:', error);
				updateStatus = 'Error deleting model. Please try again.';
			}
		}
	}
</script>

<div class="models-config">
	<div class="column models-column">
		<div class="container-row">
			<h2>Models</h2>
			{#if !showCreateForm}
				<button class="create-button" on:click={showCreate}>
					{@html getIcon('Plus', { size: 24 })}
				</button>
			{/if}
		</div>
		<hr />
		<p>Configure your AI models.</p>

		{#if isLoading}
			<LoadingSpinner />
		{:else if models.length === 0}
			<p>No models found. Create a new model to get started.</p>
		{:else}
			<div class="button-grid">
				{#each models as model (model.id)}
					<div class="model-item">
						<button class="item" on:click={() => showEdit(model)}>
							{model.name}
						</button>
						<button class="delete-button" on:click={() => handleDelete(model)}>
							{@html getIcon('Trash2', { size: 24 })}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if showCreateForm}
		<div class="column form-column" transition:fly={{ x: 300, duration: 300 }}>
			<div class="form-content">
				<h3>{selectedModel ? 'Edit Model' : 'Create New Model'}</h3>

				<div class="form-group">
					<label for="modelName">Model Name</label>
					<input
						type="text"
						id="modelName"
						bind:value={modelName}
						placeholder="Enter model name..."
					/>
				</div>

				<div class="form-group">
					<label for="modelDescription">Description</label>
					<textarea
						id="modelDescription"
						bind:value={modelDescription}
						placeholder="Enter model description..."
					></textarea>
				</div>

				<div class="form-group">
					<label for="modelApiKey">API Key</label>
					<input
						type="password"
						id="modelApiKey"
						bind:value={modelApiKey}
						placeholder="Enter API key..."
					/>
				</div>

				<div class="form-group">
					<label for="modelBaseUrl">Base URL</label>
					<input
						type="text"
						id="modelBaseUrl"
						bind:value={modelBaseUrl}
						placeholder="Enter base URL..."
					/>
				</div>

				<div class="form-group">
					<label for="modelApiType">API Type</label>
					<select id="modelApiType" bind:value={modelApiType}>
						{#each apiTypes as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="modelApiVersion">API Version</label>
					<input
						type="text"
						id="modelApiVersion"
						bind:value={modelApiVersion}
						placeholder="Enter API version..."
					/>
				</div>
			</div>

			<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>Cancel</button>
				<button class="submit-button" on:click={handleSubmit}>
					{selectedModel ? 'Update' : 'Create'}
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
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.models-config {
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

	.models-column {
		overflow-y: auto;
		justify-content: flex-start;
		display: flex;
		padding: var(--radius-m);
		background-color: blue;
		height: 100vh;
		display: flex;
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
	}

	.item:hover {
		background-color: #e0e0e0;
		transform: scale(1.05);
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
		color: black;
	}

	.model-item {
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
