<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import type { AIAgent, AIModel, Actions } from '$lib/types/types';
	import { agentStore } from '$lib/stores/agentStore';
	import { modelStore } from '$lib/stores/modelStore';
	import { actionStore } from '$lib/stores/actionStore';
	import { currentUser } from '$lib/pocketbase';
	import { createAgent, updateAgent, deleteAgent } from '$lib/clients/agentClient';
	import { ClientResponseError } from 'pocketbase';
	import { goto } from '$app/navigation';
	import { getAgentAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import AgentGen from '$lib/features/agents/components/AgentGen.svelte';

	let showCreateForm = false;
	let selectedAgent: AIAgent | null = null;
	let agents: AIAgent[] = [];
	let updateStatus = '';
	let isLoading = true;
	let avatarFile: File | null = null;
	let showGeneratorForm = false;

	let availableModels: AIModel[] = [];
	let availableActions: Actions[] = [];

	// Form fields
	let agentName = '';
	let agentDescription = '';
	let agentMaxAttempts = 5;
	let agentUserInput: 'end' | 'never' | 'always';
	let agentPrompt = '';
	let agentModel: string[] = [];
	let agentActions: string[] = [];

	// Sorting and filtering
	let searchQuery = '';
	let sortOption = '';
	let selectedRole: string | null = null;
	let selectedStatus: string | null = null;
	let selectedTags: string[] = [];
	let showFilters = false;
	let selectedAIModel: AIModel;
	let filteredAgents: AIAgent[] = [];
	let appliedFiltersCount = 0;

	const MIN_ATTEMPTS = 1;
	const MAX_ATTEMPTS = 20;

	const statusIcons: Record<string, IconName> = {
		active: 'Activity',
		inactive: 'Compass',
		maintenance: 'ServerCog',
		paused: 'OctagonPause'
	};

	const agentUserInputs: { value: 'end' | 'never' | 'always'; label: string }[] = [
		{ value: 'end', label: 'end' },
		{ value: 'never', label: 'never' },
		{ value: 'always', label: 'always' }
	];

	const sortOptions = [
		{ value: '', label: '▼ Sort by ' },
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'updated', label: 'Updated first' },
		{ value: 'az', label: 'Alphabetical ascending' },
		{ value: 'za', label: 'Alphabetical descending' }
	];

	const roleIcons: Record<string, IconName> = {
		hub: 'Cpu',
		proxy: 'ShieldCheck',
		assistant: 'HeadphonesIcon',
		moderator: 'AlertCircle'
	};

	function toggleFilters() {
		showFilters = !showFilters;
	}

	function updateAppliedFiltersCount() {
		appliedFiltersCount = (selectedRole ? 1 : 0) + (selectedStatus ? 1 : 0) + selectedTags.length;
	}

	function selectRole(role: string | null) {
		selectedRole = role;
		updateAppliedFiltersCount();
	}

	function selectStatus(status: string | null) {
		selectedStatus = status;
		updateAppliedFiltersCount();
	}

	const roles = ['hub', 'proxy', 'assistant', 'moderator'];
	const statuses = ['active', 'inactive', 'maintenance', 'paused'];

	$: filteredAgents = agents
		.filter(
			(agent) =>
				agent.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
				(!selectedRole || agent.role === selectedRole) &&
				(!selectedStatus || agent.status === selectedStatus) &&
				(selectedTags.length === 0 ||
					(agent.tags && selectedTags.every((tag) => agent.tags.includes(tag))))
		)
		.sort((a, b) => {
			switch (sortOption) {
				case 'newest':
					return new Date(b.created).getTime() - new Date(a.created).getTime();
				case 'oldest':
					return new Date(a.created).getTime() - new Date(b.created).getTime();
				case 'updated':
					return new Date(b.updated).getTime() - new Date(a.updated).getTime();
				case 'az':
					return a.name.localeCompare(b.name);
				case 'za':
					return b.name.localeCompare(a.name);
				default:
					return 0;
			}
		});

	function toggleTag(tag: string) {
		selectedTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
		updateAppliedFiltersCount();
	}

	function resetFilters() {
		selectedRole = null;
		selectedStatus = null;
		selectedTags = [];
	}

	onMount(async () => {
		if (!$currentUser) {
			console.log('User not authenticated, redirecting to login...');
			goto('/login');
			return;
		}

		showLoading();
		try {
			// Load agents for the current user (no workspace needed)
			await agentStore.loadAgents($currentUser.id);

			// Load models and actions for the current user
			await modelStore.loadModels($currentUser.id);
			await actionStore.loadActions();
		} finally {
			hideLoading();
			isLoading = false;
		}
	});
	const unsubscribeAgent = agentStore.subscribe((state) => {
		agents = state.agents || [];
		updateStatus = state.updateStatus;
	});

	const unsubscribeModel = modelStore.subscribe((state) => {
		availableModels = state.models || [];
	});

	const unsubscribeAction = actionStore.subscribe((state) => {
		availableActions = state.actions || [];
	});

	onDestroy(() => {
		unsubscribeAgent();
		unsubscribeModel();
		unsubscribeAction();
	});

	function showCreate() {
		showCreateForm = true;
		selectedAgent = null;
		resetForm();
	}

	function showGenerator(agent: AIAgent) {
		selectedAgent = agent;
		agentName = agent.name || '';
		showGeneratorForm = true;
		showCreateForm = false;
		// resetForm();
	}

	function showEdit(agent: AIAgent) {
		selectedAgent = agent;
		agentName = agent.name || '';
		agentDescription = agent.description || '';
		agentMaxAttempts = agent.max_attempts || 5;
		agentUserInput = agent.user_input || 'never';
		agentPrompt = agent.prompt || '';
		agentModel = agent.model || [];
		agentActions = agent.actions || [];
		showCreateForm = true;
	}

	function resetForm() {
		agentName = '';
		agentDescription = '';
		agentMaxAttempts = 5;
		agentUserInput = 'never';
		agentPrompt = '';
		agentModel = [];
		agentActions = [];
	}

	function toggleModel(modelId: string) {
		const index = agentModel.indexOf(modelId);
		if (index === -1) {
			agentModel = [...agentModel, modelId];
		} else {
			agentModel = agentModel.filter((id) => id !== modelId);
		}
	}

	function toggleAction(actionId: string) {
		const index = agentActions.indexOf(actionId);
		if (index === -1) {
			agentActions = [...agentActions, actionId];
		} else {
			agentActions = agentActions.filter((id) => id !== actionId);
		}
	}

	function handleCancel() {
		showCreateForm = false;
		showGeneratorForm = false;
		selectedAgent = null;
		resetForm();
	}

	async function handleDelete(agent: AIAgent) {
		if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
			try {
				await agentStore.deleteAgent(agent.id);
			} catch (error) {
				console.error('Error deleting agent:', error);
				updateStatus = 'Error deleting agent. Please try again.';
			}
		}
	}

	async function handleAvatarUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			avatarFile = input.files[0];
		}
	}

	function triggerAvatarUpload() {
		const uploadInput = document.getElementById('avatar-upload') as HTMLInputElement | null;
		if (uploadInput) uploadInput.click();
	}

	async function handleSubmit() {
		if (!agentName || !selectedRole) {
			updateStatus = 'Please fill in all required fields.';
			return;
		}

		const agentData: Partial<AIAgent> = {
			name: agentName,
			description: agentDescription,
			max_attempts: agentMaxAttempts,
			user_input: agentUserInput.toLowerCase() as 'end' | 'never' | 'always',
			prompt: agentPrompt,
			model: agentModel,
			actions: agentActions,
			role: selectedRole.toLowerCase() as 'hub' | 'proxy' | 'assistant' | 'moderator',
			status: 'inactive',
			tags: selectedTags
		};

		try {
			console.log('Submitting agent data:', agentData);
			if (selectedAgent) {
				// Update existing agent
				const formData = new FormData();
				if (avatarFile) {
					formData.append('avatar', avatarFile);
				}
				for (const [key, value] of Object.entries(agentData)) {
					if (value !== undefined && value !== null) {
						formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
					}
				}
				await agentStore.updateAgentAPI(selectedAgent.id, formData);
			} else {
				// Create new agent
				const formData = new FormData();
				if (avatarFile) {
					formData.append('avatar', avatarFile);
				}
				for (const [key, value] of Object.entries(agentData)) {
					if (value !== undefined && value !== null) {
						formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
					}
				}
				await agentStore.createAgent(formData);
			}

			showCreateForm = false;
			selectedAgent = null;
			resetForm();
			avatarFile = null;

			if ($currentUser?.id) {
				await agentStore.loadAgents($currentUser.id);
			}
		} catch (error) {
			console.error('Error saving agent:', error);
			if (error instanceof ClientResponseError) {
				console.error('Response data:', error.data);
				console.error('Status code:', error.status);
			} else if (error instanceof Error) {
				console.error('Error message:', error.message);
			}
			updateStatus = 'Error saving agent. Please try again.';
		}
	}

	function showRoleInfo() {
		// Implement role info modal or tooltip
	}

	function addTag(tag: string) {
		if (tag && !selectedTags.includes(tag)) {
			selectedTags = [...selectedTags, tag];
		}
	}

	function removeTag(tag: string) {
		selectedTags = selectedTags.filter((t) => t !== tag);
	}
</script>

<div class="agents-config">
	<div class="column agents-column">
		<!-- <hr> -->
		{#if isLoading}
			<LoadingSpinner />
		{:else if filteredAgents.length === 0}
			<p>No agents found. Create a new agent to get started.</p>
		{:else}
			<div class="button-grid" transition:fade={{ duration: 300 }}>
				{#each filteredAgents as agent (agent.id)}
					<div class="agent-item" on:click={() => showGenerator(agent)}>
						<div class="avatar-container">
							{#if agent.avatar}
								<img src={getAgentAvatarUrl(agent)} alt="Agent avatar" class="avatar" />
							{:else}
								<div class="avatar-placeholder">
									{@html getIcon('Bot', { size: 20 })}
								</div>
							{/if}
						</div>
						<div class="agent-name">{agent.name}</div>
						<div class="status-badge {agent.status}">{agent.status}</div>
						<div class="action-buttons" transition:fade={{ duration: 200 }}>
							<button class="control-button" on:click|stopPropagation={() => showEdit(agent)}>
								{@html getIcon('Settings', { size: 24 })}
							</button>
							<button
								class="control-button-delete"
								on:click|stopPropagation={() => handleDelete(agent)}
							>
								{@html getIcon('Trash2', { size: 24 })}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- <p>Configure your agents to handle different types of tasks.</p> -->
	</div>
	<div class="bottom-container">
		<div class="search-and-sort-container">
			<div class="search-container">
				{@html getIcon('Search', { size: 30 })}
				<input type="text" bind:value={searchQuery} placeholder="Search agents..." />
				<div class="container-row">
					{#if !showCreateForm}
						<button class="create-button" on:click={showCreate}>
							{@html getIcon('Plus', { size: 24 })}
						</button>
					{/if}
				</div>
			</div>
			<div class="options">
				<button class="filter-toggle-button" on:click={toggleFilters} class:active={showFilters}>
					{showFilters
						? 'Hide'
						: `Filters${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ''}`}
				</button>
				<div class="sort-container">
					<select bind:value={sortOption}>
						{#each sortOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		{#if showFilters}
			<div class="filter-section" transition:slide={{ duration: 300 }}>
				<div class="filter-container">
					<div class="filter-group">
						<div class="filter-row">
							<h3>ROLE</h3>
							<button
								class="filter-button"
								class:active={!selectedRole}
								on:click={() => selectRole(null)}
							>
								{@html getIcon('CircleOff', { size: 24 })}
							</button>
						</div>
						<div class="filter-row">
							{#each roles as role}
								<button
									class="filter-button"
									class:active={selectedRole === role}
									on:click={() => selectRole(role)}
								>
									<svelte:component this={roleIcons[role]} size={24} />
									<span>{role}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="filter-group">
						<div class="filter-row">
							<h3>STATUS</h3>
							<button
								class="filter-button"
								class:active={!selectedStatus}
								on:click={() => (selectedStatus = null)}
							>
								{@html getIcon('CircleOff', { size: 24 })}
							</button>
						</div>
						<div class="filter-row">
							{#each statuses as status}
								<button
									class="filter-button status-{status}"
									class:active={selectedStatus === status}
									on:click={() => selectStatus(status)}
								>
									<svelte:component this={statusIcons[status]} size={24} />
									<span>{status}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="filter-group">
						<div class="tag-filter">
							{#each [...new Set(agents
										.flatMap((agent) => agent.tags || [])
										.filter(Boolean))] as tag}
								<button
									class="tag-button"
									class:active={selectedTags.includes(tag)}
									on:click={() => toggleTag(tag)}
								>
									{tag}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if showCreateForm}
		<div class="column form-column" transition:fly={{ x: 300, duration: 300 }}>
			<div class="form-content">
				<div class="form-group header-row">
					<div class="avatar-upload" on:click={triggerAvatarUpload}>
						<div class="avatar-preview">
							{#if avatarFile}
								<img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" />
							{:else if selectedAgent && selectedAgent.avatar}
								<img src={getAgentAvatarUrl(selectedAgent)} alt="Current avatar" />
							{:else}
								{@html getIcon('Bot', { size: 48 })}
							{/if}
						</div>
						<div class="upload-overlay">
							{@html getIcon('Upload', { size: 24 })}
						</div>
						<input
							type="file"
							id="avatar-upload"
							accept="image/*"
							on:change={handleAvatarUpload}
							style="display: none;"
						/>
					</div>
					<h3>{selectedAgent ? 'Edit Agent' : 'Create New Agent'}</h3>
				</div>

				<div class="form-group">
					<label for="agentPrompt">PROMPT</label>
					<textarea id="agentPrompt" bind:value={agentPrompt} placeholder="Enter agent prompt..."
					></textarea>
				</div>
				<hr />
				<div class="form-group">
					<label for="agentName">NAME</label>
					<input
						type="text"
						id="agentName"
						bind:value={agentName}
						placeholder="Enter agent name..."
					/>
				</div>

				<div class="form-group">
					<label for="agentDescription">DESCRIPTION</label>
					<textarea
						id="agentDescription"
						bind:value={agentDescription}
						placeholder="Enter agent description..."
					></textarea>
				</div>

				<div class="form-group">
					<label for="agentMaxAttempts">MAX ATTEMPTS {agentMaxAttempts}</label>
					<input
						type="range"
						id="agentMaxAttempts"
						bind:value={agentMaxAttempts}
						min={MIN_ATTEMPTS}
						max={MAX_ATTEMPTS}
					/>
				</div>

				<div class="form-group">
					<label for="agentUserInput">USER INPUT</label>
					<select id="agentUserInput" bind:value={agentUserInput}>
						{#each agentUserInputs as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label>MODEL</label>
					<div class="checkbox-group">
						{#each availableModels as model (model.id)}
							<label>
								<input
									type="checkbox"
									checked={agentModel.includes(model.id)}
									on:change={() => toggleModel(model.id)}
								/>
								{model.name}
							</label>
						{/each}
					</div>
				</div>

				<div class="form-group">
					<label>ACTIONS</label>
					<div class="action-grid">
						{#each availableActions as action (action.id)}
							<button
								class="action-button"
								class:selected={agentActions.includes(action.id)}
								on:click={() => toggleAction(action.id)}
							>
								{action.name}
							</button>
						{/each}
					</div>
				</div>

				<div class="form-group">
					<label>ROLE</label>
					<div class="role-selection">
						{#each roles as role}
							<label class="role-option">
								<input type="radio" bind:group={selectedRole} value={role} />
								<span>{role}</span>
							</label>
						{/each}
					</div>
					<button class="info-button" on:click={showRoleInfo}>i</button>
				</div>

				<div class="form-group">
					<label>TAGS</label>
					<div class="tag-input">
						<input
							type="text"
							placeholder="Add a tag"
							on:keydown={(e) => {
								if (e.key === 'Enter' && e.currentTarget instanceof HTMLInputElement) {
									addTag(e.currentTarget.value);
									e.currentTarget.value = '';
								}
							}}
						/>
					</div>
					<div class="tag-list">
						{#each selectedTags as tag}
							<span class="tag">{tag} <button on:click={() => removeTag(tag)}>×</button></span>
						{/each}
					</div>
				</div>
			</div>

			<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>
					{@html getIcon('ArrowLeft', { size: 24 })}
				</button>
				<button class="submit-button" on:click={handleSubmit}>
					{#if selectedAgent}
						{@html getIcon('RefreshCcw', { size: 24 })}
					{:else}
						{@html getIcon('Plus', { size: 24 })}
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if showGeneratorForm && selectedAgent}
		<div class="column form-column" transition:fly={{ x: 300, duration: 300 }}>
			<div class="form-content">
				<div class="form-group header-row">
					<div class="avatar-upload" on:click={triggerAvatarUpload}>
						<div class="avatar-preview">
							{#if avatarFile}
								<img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" />
							{:else if selectedAgent && selectedAgent.avatar}
								<img src={getAgentAvatarUrl(selectedAgent)} alt="Current avatar" />
							{:else}
								{@html getIcon('Bot', { size: 48 })}
							{/if}
						</div>
						<div class="upload-overlay">
							{@html getIcon('Upload', { size: 24 })}
						</div>
						<input
							type="file"
							id="avatar-upload"
							accept="image/*"
							on:change={handleAvatarUpload}
							style="display: none;"
						/>
					</div>
					<h3>Generate Agent: {selectedAgent ? selectedAgent.name : ''}</h3>
				</div>

				<!-- Add your generator form fields here
                <div class="form-group">
                    <label>ROLE</label>
                    <div class="role-selection">
                        {#each roles as role}
                            <label class="role-option">
                                <input type="radio" bind:group={selectedRole} value={role}>
                                <span>{role}</span>
                            </label>
                        {/each}
                    </div>
                    <button class="info-button" on:click={showRoleInfo}>i</button>
                </div>
            
                <div class="form-group">
                    <label>TAGS</label>
                    <div class="tag-input">
                        <input type="text" placeholder="Add a tag" on:keydown={(e) => e.key === 'Enter' && addTag((e.target).value)}>
                    </div>
                    <div class="tag-list">
                        {#each selectedTags as tag}
                            <span class="tag">{tag} <button on:click={() => removeTag(tag)}>×</button></span>
                        {/each}
                    </div>
                </div> -->

				<AgentGen
					parentAgent={selectedAgent}
					aiModel={selectedAIModel}
					userId={$currentUser?.id || ''}
				/>
				<div class="form-group">
					<label for="aiModel">AI Model</label>
					<select id="aiModel" bind:value={selectedAIModel}>
						<option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
						<option value="gpt-4">GPT-4</option>
						<option value="claude-v1">Claude v1</option>
						<!-- Add other models as needed -->
					</select>
				</div>
			</div>

			<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>
					{@html getIcon('ArrowLeft', { size: 24 })}
				</button>
				<button class="submit-button" on:click={handleSubmit}>
					{#if selectedAgent}
						{@html getIcon('RefreshCcw', { size: 24 })}
					{:else}
						{@html getIcon('Plus', { size: 24 })}
					{/if}
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
		color: var(--text-color);
	}
	.agents-config {
		display: flex;
		position: relative;
		/* height: 100%; */
		overflow: hidden;
		width: 100%;
		height: 80vh;
		/* border-radius: 30px; */
		/* border-bottom-left-radius: 20px;  */
		/* border-bottom-right-radius: 20px; */
		/* border-top: 5px solid #262929; */
		/* background: linear-gradient(145deg, #363f3f, #1a1a1a); */
		/* justify-content: center; */
		/* align-items: center; */
		/* padding: 20px; */
		/* width: calc(100% - 40px); */
		/* margin-left: 10px; */
		/* height: calc(100vh - 260px); */
		transition: all 1.8s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.column {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		justify-content: flex-start;
	}

	.agents-column {
		display: flex;
		flex-direction: column;
		background-color: var(--secondary-color);
		/* align-items: flex-start; */
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: gray transparent;
		/* background: linear-gradient(to bottom, #2c3e50, #4ca1af);  */
	}

	.form-column {
		display: flex;
		flex-direction: column;
		/* padding: 20px; */
		height: 99%;
		/* width: auto; */

		/* width: 70vh; */
	}

	.form-content {
		flex-grow: 1;
		overflow: hidden;
		/* background: linear-gradient(to bottom, #2c3e50, #4ca1af);  */
		// background: linear-gradient(to bottom, #e6f3ff, #759ca2);
		background: var(--bg-gradient-right);

		padding: 20px;
		border-radius: 20px;
		border-left: 3px solid #323232;
		border-bottom: 3px solid #323232;
		border-top: 3px solid #323232;
		/* height: 80vh; */
		margin-top: 10px;
		width: 70vh;
	}

	.generator-content {
		flex-grow: 1;
		overflow: hidden;
		background: radial-gradient(
			circle at top,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 90%
		);
		padding: 20px;
		border-radius: 50px;
		justify-content: flex-start;
		height: 80vh;
		width: 50vh;
		display: flex;
		flex-direction: column;
	}

	.form-group {
		margin-bottom: 20px;
		padding: 20px;
	}

	label {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		margin-bottom: 5px;
		color: #4d4d4d;
		font-size: 16px;
	}

	input[type='text'],
	input[type='password'] {
		width: 100%;
		padding: 10px;
		border: none;
		border-radius: 50px;
		font-size: 16px;
		background-color: transparent;
	}

	select {
		/* width: 100%; */
		background-color: #323232;
		/* border-radius: 14px; */
		font-size: 16px;
		width: 100%;
		color: gray;
		border: none;
		height: 40px;
		outline: none;
	}

	textarea {
		/* height: 100px; */
		width: 100%;
		padding: 10px;
		border: none;
		font-size: 20px;
		background: radial-gradient(
			circle at left,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 90%
		);
		resize: none;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		border-radius: 14px;
	}

	.button-grid {
		display: flex;
		flex-direction: column;
		position: absolute;
		top: 84px;
		width: 100%;
		/* border-radius: 12px; */
		/* max-width: 300px; */
		/* background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 90%); */
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Adds a soft shadow for depth */
		overflow-y: auto;
		overflow-x: hidden;

		max-height: 88vh;
	}

	.button-group {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		position: fixed;
		bottom: 40px;
		gap: 10px;
		/* margin-top: 20px; */
		width: 100%;
		z-index: 2000;
	}

	button {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		/* padding: 20px 20px; */
		border: none;
		gap: 5px;
		/* margin-bottom: 20px; */
		border-radius: 4px;
		width: 100%;
		/* height: 60px; */
		font-size: 16px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.cancel-button {
		gap: 5px;
		padding: 5px;
		background-color: #323232;
		color: gray;
		border: 2px solid #4b4b4b;
		border-radius: 14px;
		cursor: pointer;
		transition: background-color 0.3s;
		width: 70px;
		height: 70px;
		border-radius: 50%;
		display: flex;
		/* position: fixed; */
		margin-bottom: 100px;
		/* bottom: calc(20% + 64px); */
		/* left: calc(26% - 35px); */
	}

	.cancel-button:hover {
		background-color: #bbb;
	}

	.submit-button {
		gap: 5px;
		padding: 5px;
		background-color: #323232;
		color: gray;
		border: 2px solid #4b4b4b;
		border-radius: 14px;
		cursor: pointer;
		transition: background-color 0.3s;
		width: 70px;
		height: 70px;
		border-radius: 50%;
		display: flex;
		position: fixed;
		margin-right: 40px;
		right: 0;
	}

	.submit-button:hover {
		background-color: #45a049;
		color: white;
	}

	.create-button {
		background-color: #4caf50;
		position: absolute;
		right: 10px;
		top: 5px;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: none; /* Optional */
		height: 30px;
		width: 30px;
		cursor: pointer;
	}

	.create-button:hover {
		background-color: #45a049;
	}

	.container-row {
		display: flex;
		flex-direction: row;
		margin-top: 20px;
		justify-content: space-between;
		/* margin-right: 50px; */
		align-items: flex-start;
		margin-right: 5rem;
	}

	.item {
		background-color: transparent;
		color: #646464;
		/* height: 50px; */
		transition: transform 1.8s cubic-bezier(0.075, 0.82, 0.165, 1);
		/* margin-right: 10px; */
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		padding: 5px;
		width: 70%;
		border: 1px solid #4b4b4b;
		border-radius: 14px;
	}

	.item:hover {
		background-color: #5a6565;
		transform: scale(0.95);
		/* box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); */
		color: black;
		cursor: text;
		font-weight: normal;
	}

	.agent-item {
		display: flex;
		flex-direction: row;
		width: auto;
		margin-left: 1rem;
		margin-right: 1rem;
		justify-content: flex-start;
		align-items: center;
		border-bottom: 1px solid #ffffff;
		/* box-shadow: 0 2px 4px rgba(0,0,0,0.2); */
		transition: all 0.3s ease;
		opacity: 0.7;
		padding: 10px;
		position: relative;
	}
	.agent-item:hover {
		/* background-color: #f0f0f0; */
		transform: scale(0.95);
		cursor: pointer;
		opacity: 1;
	}

	.delete-button,
	.mini-button {
		background-color: transparent;
		color: rgb(202, 202, 202);
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
		color: #ff0000;
	}

	.mini-button:hover {
		color: #3a08ba;
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
		border-top: 2px solid rgb(108, 108, 108);
		margin: 0;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.avatar-container {
		display: flex;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		/* scale: 1.5; */
		justify-content: center;
		align-items: center;
		overflow: hidden;
		border-radius: 50%;
		background-color: #e0e0e0;
		flex-shrink: 0;
		margin-right: 10px;
	}

	.avatar {
		width: 100%;
		height: 100%;
		/* border-radius: 20px; */
		/* margin-left: 5%; */

		/* width: 100px; */
		/* height: 100%; */
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		/* background-color: #e0e0e0; */
		color: #757575;
	}

	.status-badge {
		position: absolute;
		display: flex;
		flex-direction: row;
		right: 0;
		top: 0;
		width: auto;
		text-align: center;
		align-items: center;
		justify-content: center;
		padding: 2px 5px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: bold;
		background-color: #333333;
		color: white;
		z-index: 1; /* Ensure it's above other elements */
	}

	.status-active {
		background-color: #1f1f1f;
		color: white;
	}
	.status-inactive {
		background-color: #1f1f1f;
		color: white;
	}
	.status-maintenance {
		background-color: #1f1f1f;
		color: black;
	}
	.status-paused {
		background-color: #1f1f1f;
		color: white;
	}

	.container-row:hover .data-counts {
		display: none;
	}
	.container-row:hover .action-buttons {
		display: flex;
	}

	.data-counts,
	.action-buttons {
		position: absolute;
		right: 2px;
		bottom: 2px;
		/* transform: translateY(-50%); */
		display: none;
		gap: 2px;
		z-index: 2; /* Ensure it's above the status badge */
	}

	.agent-item:hover .action-buttons {
		display: flex;
	}

	.control-button,
	.control-button-delete {
		background-color: transparent;
		color: gray;
		transition: all 0.3s ease;
	}

	.control-button:hover {
		color: white;
	}

	.control-button-delete:hover {
		color: red;
	}
	.search-container {
		/* position: fixed; */
		justify-content: center;
		align-items: center;
		display: flex;
		color: gray;
		height: 40px;
		/* width: calc(100vh - 40px); */
		/* height: 50px; */
		display: flex;
		flex-direction: row;
		padding-left: 10px;
		/* border-radius: 8px; */

		z-index: 1002;
		background-color: var(--primary-color);
		width: 100%;
		/* background-image: linear-gradient(to top, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0)); */
		color: white;
	}

	.sort-container {
		display: flex;
		/* align-items: center; */
		/* margin-bottom: 10px; */
		width: 100%;
	}

	.sort-container select {
		border-radius: 0;
		user-select: none;
		background-color: var(--primary-color);

		color: var(--text-color);
	}

	.options {
		display: flex;
		flex-direction: row;
		justify-content: center;
		width: 100%;
	}

	.filter-section {
		width: 100%;
	}

	.filter-section h4 {
		color: #ffffff;
	}

	.filter-container {
		display: flex;
		flex-direction: column;
		background-color: #323232;
		/* background-image: linear-gradient(to bottom, rgba(254, 254, 254, 0.9), rgba(0, 0, 0, 0)); */
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		padding: 6px;
		/* border-radius: 10px; */
	}

	.filter-row,
	.tag-filter {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		align-items: center;
	}

	.filter-row {
		display: flex;
		gap: 5px;
	}

	.filter-button,
	.tag-button {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;
		padding: 10px;
		color: gray;
		user-select: none;
		background-color: #323232;
		border: none;
		/* border-radius: 14px; */
		cursor: pointer;
		transition: background-color 0.3s ease;
		width: fit-content; /* Button's width fits its content */
		white-space: nowrap; /* Prevents text from wrapping inside buttons */
	}

	.filter-button:hover,
	.tag-button:hover {
		background-color: #616161;
	}

	.filter-button.active,
	.tag-button.active {
		background-color: #1f1f1f;
		color: white;
	}

	.status-active {
		background-color: #323232;
	}
	.status-inactive {
		background-color: #323232;
	}
	.status-maintenance {
		background-color: #323232;
	}
	.status-paused {
		background-color: #323232;
	}

	.tag-filter {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.role-selection {
		display: flex;
		gap: 10px;
	}

	.role-option {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.info-button {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background-color: #2196f3;
		color: white;
		border: none;
		cursor: pointer;
	}

	.tag-input {
		margin-bottom: 10px;
		background: radial-gradient(
			circle at left,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 90%
		);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.tag {
		background-color: #e0e0e0;
		padding: 2px 5px;
		border-radius: 10px;
		font-size: 12px;
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	.avatar-upload {
		position: relative;
		width: 80px;
		height: 80px;
		cursor: pointer;
	}

	.avatar-preview {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #f0f0f0;
	}

	.avatar-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-upload-label {
		cursor: pointer;
		padding: 5px 10px;
		background-color: #4caf50;
		color: white;
		border-radius: 5px;
	}

	.upload-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		opacity: 0;
		transition: opacity 0.3s;
		border-radius: 50%;
	}

	.avatar-upload:hover .upload-overlay {
		opacity: 1;
	}

	.upload-overlay :global(svg) {
		color: white;
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		padding: 20px;
	}

	.search-and-sort-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.bottom-container {
		position: absolute;
		justify-content: center;
		align-items: center;
		left: 0;
		right: 0;
		color: gray;
		/* width: calc(100vh - 40px); */
		/* height: 50px; */
		display: flex;
		flex-direction: column;
		background-color: #1f1f1f;
		z-index: 1002;
		/* width: 40%; */
		background-color: transparent;
		/* background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0)); */
		/* border-radius: 20px; */
	}

	.agent-name {
		flex-grow: 1;
		color: white;
		font-size: 16px;
	}

	.filter-toggle-button {
		/* display: flex; */
		align-items: center;
		justify-content: left;
		gap: 5px;
		padding: 8px 12px;
		height: 40px;
		background-color: var(--primary-color);
		color: var(--text-color);
		border-right: 1px solid black;
		/* border-radius: 14px; */
		cursor: pointer;
		transition: background-color 0.3s;
		user-select: none;
		width: 100%;
		font-size: 16px;
	}

	.filter-toggle-button:hover,
	.sort-container select:hover {
		background-color: var(--tertiary-color);
	}

	.filter-toggle-button.active {
		background-color: #1f1f1f;
	}

	h3 {
		user-select: none;
	}

	p {
		color: #ffffff;
		font-size: 20px;
		padding: 20px;
	}

	input {
		color: var(--text-color);
		outline: none;
		background-color: var(--primary-color);
	}

	@media (max-width: 1700px) {
	}

	@media (max-width: 750px) {
		.agent-name {
			font-size: 12px;
			justify-content: flex-end;
			align-items: center;
		}

		.button-row {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}
</style>
