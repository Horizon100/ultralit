<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { AIAgent, AIModel } from '$lib/types/types';
	import { ArrowRight, Plus, Trash2, Edit2, Check } from 'lucide-svelte';
	import { createAgent, updateAgent, deleteAgent } from '$lib/clients/agentClient';
	import { ClientResponseError } from 'pocketbase';
	import { erpAgentTemplates } from '$lib/features/agents/utils/erp'; 
	import { agentStore } from '$lib/stores/agentStore';
	import CircularAgentView from '$lib/features/agents/components/CircularAgentView.svelte';
	import { isLoading, showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';

	export let parentAgent: AIAgent;
	export let aiModel: AIModel;
	export let userId: string;

	let seedPrompt = '';
	let childAgents: AIAgent[] = [];
	let errorMessage = '';
	let expandedTemplate: number | null = null;
	let isCircularView = false;
	let loading = true;

	const dispatch = createEventDispatcher();
	$: childAgents = [];

	onMount(async () => {
		try {
			await loadChildAgents();
		} catch (error) {
			handleError(error);
		}
	});

	async function loadChildAgents() {
		loading = true;
		showLoading();
		try {
			const agents = await agentStore.loadAgents(userId);
			if (Array.isArray(agents)) {
				childAgents = agents.filter((agent: AIAgent) => agent.parent_agent === parentAgent.id);
			} else {
				console.error('loadAgents did not return an array');
				childAgents = [];
			}
		} catch (error) {
			handleError(error);
		} finally {
			loading = false;
			hideLoading();
		}
	}

	async function handleSeedPromptSubmit() {
		if (seedPrompt.trim()) {
			try {
				const newAgent = await createAgent({
					name: `Child of ${parentAgent.name}`,
					description: seedPrompt,
					parent_agent: parentAgent.id,
					user_id: userId
					// Add other necessary fields
				});
				await addChildAgent(newAgent);
				seedPrompt = ''; // Clear the input after successful submission
			} catch (error) {
				handleError(error);
			}
		}
	}

	async function updateParentAgent() {
		try {
			const updatedParent = await updateAgent(parentAgent.id, {
				child_agents: childAgents.map((agent) => agent.id)
			});
			parentAgent = updatedParent; // Update the local parentAgent state
		} catch (error) {
			handleError(error);
		}
	}

	async function addChildAgent(newAgent: AIAgent) {
		childAgents = [...childAgents, newAgent];
		await updateParentAgent();
	}

	function selectTemplate(index: number) {
		expandedTemplate = expandedTemplate === index ? null : index;
	}

	async function confirmTemplate(template) {
		try {
			const newAgent = await createAgent({
				name: template.name,
				description: template.description,
				prompt: template.prompt,
				parent_agent: parentAgent.id,
				user_id: userId
				// Add other necessary fields from the template
			});
			await addChildAgent(newAgent);
			expandedTemplate = null;
		} catch (error) {
			handleError(error);
		}
	}
	async function handleDeleteChildAgent(agent: AIAgent) {
		if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
			try {
				await deleteAgent(agent.id);
				childAgents = childAgents.filter((a) => a.id !== agent.id);
				await updateParentAgent();
			} catch (error) {
				handleError(error);
			}
		}
	}

	function handleEditChildAgent(agent: AIAgent) {
		// Implement edit functionality
		console.log('Editing agent:', agent);
	}

	function handleOpenChildAgentOverlay(agent: AIAgent) {
		// Implement opening child agent overlay
		console.log('Opening child agent overlay:', agent);
	}

	function handleError(error: unknown) {
		console.error('Error:', error);
		if (error instanceof ClientResponseError) {
			errorMessage = `Error: ${error.message}. Status: ${error.status}`;
		} else if (error instanceof Error) {
			errorMessage = `Error: ${error.message}`;
		} else {
			errorMessage = 'An unknown error occurred';
		}
	}

	function toggleView() {
		isCircularView = !isCircularView;
	}

	function handleAgentClick(agent: AIAgent) {
		console.log('Clicked agent:', agent);
		// Implement your logic for handling agent clicks here
	}
</script>

<div class="agent-gen-container">
	<h2>{parentAgent.name} Organization</h2>

	<div class="controls">
		<button on:click={toggleView} class="toggle-view-btn">
			{isCircularView ? 'Switch to Card View' : 'Switch to Circular View'}
		</button>
		<!-- Add your model selector here if you have one -->
	</div>

	{#if errorMessage}
		<div class="error-message">{errorMessage}</div>
	{/if}

	<div class="view-container">
		{#if loading}
			<div class="loading-container">
				<LoadingSpinner />
			</div>
		{:else if isCircularView}
			<div class="circular-view-wrapper" transition:fade={{ duration: 300 }}>
				<CircularAgentView agents={childAgents} onAgentClick={handleAgentClick} />
			</div>
		{:else}
			<div class="child-agents-container" transition:fade={{ duration: 300 }}>
				{#if childAgents.length === 0}
					<p>No child agents found.</p>
				{:else}
					{#each childAgents as agent (agent.id)}
						<div class="child-agent-card">
							<h3>{agent.name}</h3>
							<p>{agent.description}</p>
							<div class="agent-actions">
								<button on:click={() => handleEditChildAgent(agent)}><Edit2 size="16" /></button>
								<button on:click={() => handleDeleteChildAgent(agent)}><Trash2 size="16" /></button>
								<button on:click={() => handleOpenChildAgentOverlay(agent)}
									><Plus size="16" /></button
								>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.agent-gen-container {
		margin: 0 auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: auto;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.toggle-view-btn {
		background-color: #4caf50;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.toggle-view-btn:hover {
		background-color: #45a049;
	}

	.view-container {
		flex-grow: 1;
		overflow-y: auto;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.circular-view-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.child-agents-container {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 20px;
		width: 100%;
		height: 100%;
	}

	.child-agent-card {
		background-color: white;
		border-radius: 5px;
		padding: 15px;
		width: 100%;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
	}

	.child-agent-card h3 {
		margin-top: 0;
		word-break: break-word;
	}

	.child-agent-card p {
		flex-grow: 1;
		word-break: break-word;
	}

	.agent-actions {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
	}

	.agent-actions button {
		padding: 5px;
		margin: 0;
		flex: 1;
		max-width: 30%;
	}

	.error-message {
		color: red;
		margin-bottom: 10px;
	}

	@media (max-width: 600px) {
		.child-agents-container {
			grid-template-columns: 1fr;
		}
	}
</style>
