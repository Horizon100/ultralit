<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { AIAgent, PartialAIAgent } from '$lib/types/types';
	import { agentStore } from '$lib/stores/agentStore';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

	export let selectedShape: AIAgent | null;
	export let width: number;

	const dispatch = createEventDispatcher();

	let activeTab: 'layers' | 'style' = 'layers';
	let editedAgent: PartialAIAgent | null = null;
	let updateMessage: string = '';
	let updateStatus: 'success' | 'error' | '' = '';

	$: if (selectedShape) {
		editedAgent = {
			...selectedShape,
			provider: selectedShape.provider || ''
		};
	}

	function setActiveTab(tab: 'layers' | 'style') {
		activeTab = tab;
	}

	async function updateAgent() {
		if (editedAgent && selectedShape) {
			const result = await clientTryCatch(
				Promise.resolve(agentStore.updateAgent(selectedShape.id, editedAgent)),
				'Updating agent'
			);

			if (isFailure(result)) {
				updateMessage = `Error updating agent: ${result.error}`;
				updateStatus = 'error';
			} else {
				updateMessage = 'Agent updated successfully';
				updateStatus = 'success';
			}

			setTimeout(() => {
				updateMessage = '';
				updateStatus = '';
			}, 3000);
		}
	}

	$: console.log('selectedShape:', selectedShape);
	$: console.log('editedAgent:', editedAgent);
</script>

<div class="side-menu" style="width: {width}px;" on:mouseleave={() => dispatch('mouseleave')}>
	<div class="tabs">
		<button class:active={activeTab === 'layers'} on:click={() => setActiveTab('layers')}
			>Layers</button
		>
		<button class:active={activeTab === 'style'} on:click={() => setActiveTab('style')}
			>Style</button
		>
	</div>
	<div class="content">
		{#if activeTab === 'layers'}
			{#if selectedShape && editedAgent}
				<!-- <h3>Selected Agent</h3> -->
				<!-- <div class="field">
          <label for="avatar">Avatar:</label>
          <input id="avatar" bind:value={editedAgent.avatar} />
        </div> -->

				<div class="field">
					<label for="name">Name:</label>
					<input
						id="name"
						type="text"
						bind:value={editedAgent.name}
						on:input={(e) => {
							if (e.target && 'value' in e.target) {
								console.log('Input changed:', e.target.value);
							}
						}}
					/>
				</div>
				<div class="handle">
					<div class="field">
						<label for="status">Status:</label>
						<select id="status" bind:value={editedAgent.status}>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
							<option value="maintenance">Maintenance</option>
							<option value="paused">Paused</option>
						</select>
					</div>
					<div class="field">
						<label for="version">Version:</label>
						<span id="version">{editedAgent.version}</span>
					</div>
				</div>

				<div class="handle">
					<div class="field">
						<label for="role">Role:</label>
						<select id="role" bind:value={editedAgent.role}>
							<option value="admin">Admin</option>
							<option value="user">User</option>
							<option value="guest">Guest</option>
						</select>
					</div>
				</div>

				<div class="field">
					<label for="prompt">Prompt:</label>
					<input id="prompt" type="text" bind:value={editedAgent.prompt} />
				</div>
				<!-- <div class="field">
          <label for="description">Description:</label>
          <textarea id="description" bind:value={editedAgent.description}></textarea>
        </div> -->

				<!-- <div class="field">
          <label for="capabilities">Capabilities:</label>
          <input id="capabilities" bind:value={editedAgent.capabilities?.join(', ') || ''} />
        </div> -->

				<!-- <div class="field">
          <label for="performance">Performance:</label>
          <input id="performance" type="number" bind:value={editedAgent.performance} />
        </div> -->

				<button on:click={updateAgent}>Update Agent</button>
				{#if updateMessage}
					<p class="message {updateStatus}">{updateMessage}</p>
				{/if}
			{:else}
				<p>No agent selected</p>
			{/if}
		{:else if activeTab === 'style'}
			<!-- Add style content here -->
		{/if}
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.side-menu {
		height: 100%;
		transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		overflow-y: auto;
		background-color: #343434;
		backdrop-filter: blur(3px);
		color: white;
	}

	.tabs {
		display: flex;
		justify-content: space-around;
		padding: 1rem;
	}

	.tabs button {
		padding: 0.5rem 1rem;
		border: none;
		background-color: transparent;
		cursor: pointer;
		color: white;
		font-size: 24px;
	}

	.tabs button.active {
		border-bottom: 2px solid #333;
	}

	.content {
		padding: 1rem;
	}

	.field {
		padding: 5px;
		width: 80%;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		background-color: #2a3130;
		color: white;
		border: 1px solid #4a5a5a;
		border-radius: 4px;
	}

	button {
		background-color: #4caf50;
		color: white;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		margin-top: 1rem;
	}

	.message {
		margin-top: 1rem;
		padding: 0.5rem;
		border-radius: 4px;
	}

	.success {
		background-color: #4caf50;
	}

	.error {
		background-color: #f44336;
	}

	.handle {
		display: flex;
		gap: 1rem;
		flex-direction: row;
	}

	input,
	select {
		width: 100%;
		padding: 0.5rem;
		background-color: var(--primary-color);
		color: var(--text-color);
		border: 1px solid var(--line-color);
		border-radius: 4px;
		pointer-events: auto;
		opacity: 1;
	}
</style>
