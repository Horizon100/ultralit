<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { AIAgent, AIModel, Actions, ProviderType, SelectableAIModel} from '$lib/types/types';
	import { agentStore } from '$lib/stores/agentStore';
	import { modelStore } from '$lib/stores/modelStore';
	import { actionStore } from '$lib/stores/actionStore';
	import { currentUser, getFileUrl } from '$lib/pocketbase';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import { get } from 'svelte/store';
	import PocketBase from 'pocketbase';
	import { createAgent, updateAgent, deleteAgent } from '$lib/clients/agentClient';
	import { ClientResponseError } from 'pocketbase';
	import { goto } from '$app/navigation';
	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';
	import AgentGen from '$lib/features/agents/components/AgentGen.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { t } from '$lib/stores/translationStore';
import { ensureModelsExist } from '$lib/features/ai/utils/modelUtils';
import { getAgentAvatarUrl } from '$lib/features/agents/utils/agentAvatarUtils';

	let showCreateForm = false;
	let selectedAgent: AIAgent | null = null;
	let agents: AIAgent[] = [];
	let updateStatus = '';
	let isLoading = true;
	let avatarFile: File | null = null;
	let showGeneratorForm = false;
	let tagInput = '';
let localModels: SelectableAIModel[] = [];
let localServerStatus: 'online' | 'offline' | 'unknown' = 'unknown';
let isLoadingLocalModels = false;
	let availableModels: AIModel[] = [];
	let availableActions: Actions[] = [];
	let selectedProvider: ProviderType | null = null;

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

	const pb = new PocketBase(get(pocketbaseUrl));

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
		{ value: '', label: 'Sort by' },
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
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			addTag(tagInput);
			tagInput = '';
		}
	}
$: modelsByProvider = availableModels.reduce(
	(acc, model) => {
		if (!acc[model.provider]) {
			acc[model.provider] = [];
		}
		acc[model.provider].push(model);
		return acc;
	},
	{} as Record<ProviderType, AIModel[]>
);
async function cleanupDuplicateModels() {
	if (!$currentUser) return;
	
	console.log('🧹 Starting model cleanup...');
	showLoading();
	
	try {
		await modelStore.cleanupDuplicateModels($currentUser.id);
		// Reload models after cleanup
		await modelStore.loadModels($currentUser.id);
		updateStatus = 'Duplicate models cleaned up successfully!';
	} catch (error) {
		console.error('Cleanup failed:', error);
		updateStatus = 'Failed to cleanup models';
	} finally {
		hideLoading();
		setTimeout(() => updateStatus = '', 3000);
	}
}

$: allProviders = [...Object.keys(modelsByProvider), 'local'] as ProviderType[];
$: providers = allProviders;

$: if (!selectedProvider && providers.length > 0) {
	selectedProvider = providers[0] as ProviderType;
}
$: if (selectedProvider && selectedProvider !== 'local') {
	console.log(`Debug: Provider ${selectedProvider} has ${modelsByProvider[selectedProvider]?.length || 0} models:`, 
		modelsByProvider[selectedProvider]?.map(m => m.name) || []);
}
async function loadLocalModels() {
	isLoadingLocalModels = true;
	try {
		console.log('Loading local models for agent management...');
		
		const response = await fetch('/api/ai/local/models');
		const result = await response.json();

		if (result.success) {
			const data = result.data;
			localServerStatus = data.server_info?.status === 'connected' ? 'online' : 'offline';
			
			// Convert local models to SelectableAIModel format
			localModels = (data.models || []).map((model: any) => ({
				id: model.api_type,
				name: model.name,
				provider: 'local' as ProviderType,
				context_length: model.context_length || 4096,
				description: model.description || `Local model: ${model.name}`,
				api_type: model.api_type,
				size: model.size,
				parameters: model.parameters,
				families: model.families || [],
				available: true
			}));
			
			console.log(`Loaded ${localModels.length} local models, status: ${localServerStatus}`);
		} else {
			console.warn('Failed to load local models:', result.error);
			localServerStatus = 'offline';
			localModels = [];
		}
	} catch (error) {
		console.error('Error loading local models:', error);
		localServerStatus = 'offline';
		localModels = [];
	} finally {
		isLoadingLocalModels = false;
	}
}
function toggleModel(modelId: string) {
	if (agentModel.includes(modelId)) {
		agentModel = agentModel.filter((id) => id !== modelId);
	} else {
		agentModel = [...agentModel, modelId];
	}
}
function isLocalProvider(provider: ProviderType): boolean {
	return provider === 'local';
}

function getLocalServerStatus(): 'success' | 'error' | 'loading' {
	if (isLoadingLocalModels) return 'loading';
	if (localServerStatus === 'online') return 'success';
	return 'error';
}


function selectProvider(provider: ProviderType) {
	selectedProvider = provider;
	
	// If selecting local provider and models aren't loaded, load them
	if (provider === 'local' && localModels.length === 0) {
		loadLocalModels();
	}
}
function getProviderDisplayName(provider: ProviderType): string {
	const names = {
		openai: 'OpenAI',
		anthropic: 'Anthropic',
		google: 'Google',
		grok: 'Grok',
		deepseek: 'DeepSeek',
		local: `Local Models ${localServerStatus === 'online' ? '🟢' : localServerStatus === 'offline' ? '🔴' : '⚪'}`
	};
	return names[provider] || provider;
}
function getModelDisplayInfo(model: AIModel): { name: string; info: string } {
	if (model.provider === 'local') {
		const localModel = localModels.find(lm => lm.id === model.id);
		return {
			name: model.name,
			info: localModel?.parameters ? `${localModel.parameters} params` : 'Local model'
		};
	}
	
	return {
		name: model.name,
		info: model.description || `${model.provider} model`
	};
}

	function toggleFilters() {
		showFilters = !showFilters;
		if (!showFilters) {
			selectedRole = null;
			selectedStatus = null;
			selectedTags = [];
		}
	}

	const roles = ['hub', 'proxy', 'assistant', 'moderator'];
	const statuses = ['active', 'inactive', 'maintenance', 'paused'];

	async function loadAgents() {
		showLoading();
		try {
			if ($currentUser && $currentUser.id) {
				await agentStore.loadAgents($currentUser.id);
			}
		} finally {
			hideLoading();
		}
	}

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
		await loadAgents();
		await modelStore.loadModels($currentUser.id);
		await actionStore.loadActions();
		await loadLocalModels(); 
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

	/*
	 * function toggleModel(modelId: string) {
	 * 	const index = agentModel.indexOf(modelId);
	 * 	if (index === -1) {
	 * 		agentModel = [...agentModel, modelId];
	 * 	} else {
	 * 		agentModel = agentModel.filter((id) => id !== modelId);
	 * 	}
	 * }
	 */

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

	/*
	 * async function handleSubmit() {
	 *   const agentData: Partial<AIAgent> = {
	 *     name: agentName,
	 *     description: agentDescription,
	 *     max_attempts: agentMaxAttempts,
	 *     user_input: agentUserInput,
	 *     prompt: agentPrompt,
	 *     model: agentModel,
	 *     actions: agentActions,
	 *   };
	 */

	/*
	 *   try {
	 *     if (selectedAgent) {
	 *       agentStore.updateAgent(selectedAgent.id, agentData);
	 *     } else {
	 *       const newAgent = await createAgent(agentData);
	 *       agentStore.addAgent(newAgent);
	 *     }
	 *     showCreateForm = false;
	 *     selectedAgent = null;
	 *     resetForm();
	 *   } catch (error) {
	 *     console.error('Error saving agent:', error);
	 *     updateStatus = 'Error saving agent. Please try again.';
	 *   }
	 * }
	 */

	async function handleDelete(agent: AIAgent) {
		if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
			try {
				await deleteAgent(agent.id);
				agentStore.removeAgent(agent.id);
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
	// Enhanced validation for required fields
	const missingFields = [];
	
	if (!agentName?.trim()) {
		missingFields.push('Name');
	}
	
	if (!agentPrompt?.trim()) {
		missingFields.push('Prompt');
	}
	
	if (!selectedRole) {
		missingFields.push('Role');
	}
	
	if (agentModel.length === 0) {
		missingFields.push('Model');
	}

	if (missingFields.length > 0) {
		updateStatus = `Please fill in all required fields: ${missingFields.join(', ')}.`;
		setTimeout(() => {
			updateStatus = '';
		}, 5000);
		return;
	}

	try {
		console.log('🔄 Processing agent submission...');
		updateStatus = 'Processing models...';
		
		// Ensure models exist in the models collection and get their IDs
		const modelIds = await ensureModelsExist(agentModel, $currentUser?.id || '');
		
		const agentData: Partial<AIAgent> = {
			name: agentName.trim(),
			description: agentDescription?.trim() || '',
			max_attempts: agentMaxAttempts,
			user_input: agentUserInput.toLowerCase() as 'end' | 'never' | 'always',
			prompt: agentPrompt.trim(),
			// Use the model IDs for the relation field
			model: modelIds,
			role: selectedRole!.toLowerCase() as 'hub' | 'proxy' | 'assistant' | 'moderator',
			status: 'active'
		};

		// Handle actions - store as JSON if it's a text field, or as array if it's JSON field
		if (agentActions.length > 0) {
			agentData.actions = agentActions;
		}

		// Handle tags - store as JSON if it's a text field, or as array if it's JSON field
		if (selectedTags.length > 0) {
			agentData.tags = selectedTags;
		}

		console.log('📤 Submitting agent data:', agentData);
		updateStatus = 'Saving agent...';
		
		if (selectedAgent) {
			// For updates
			const result = await agentStore.updateAgentAPI(
				selectedAgent.id,
				avatarFile
					? (() => {
							const formData = new FormData();
							if (avatarFile) formData.append('avatar', avatarFile);
							
							// Add all other fields to FormData
							for (const [key, value] of Object.entries(agentData)) {
								if (value !== undefined && value !== null) {
									if (Array.isArray(value)) {
										// For relation fields, send as JSON array
										formData.append(key, JSON.stringify(value));
									} else {
										formData.append(key, String(value));
									}
								}
							}
							return formData;
						})()
					: agentData
			);
			
			if (!result) {
				throw new Error('Failed to update agent');
			}
			
			console.log('✅ Agent updated successfully:', result);
		} else {
			// For creation
			const result = await agentStore.createAgent(
				avatarFile
					? (() => {
							const formData = new FormData();
							if (avatarFile) formData.append('avatar', avatarFile);
							
							// Add all other fields to FormData
							for (const [key, value] of Object.entries(agentData)) {
								if (value !== undefined && value !== null) {
									if (Array.isArray(value)) {
										// For relation fields, send as JSON array
										formData.append(key, JSON.stringify(value));
									} else {
										formData.append(key, String(value));
									}
								}
							}
							return formData;
						})()
					: agentData
			);
			
			if (!result) {
				throw new Error('Failed to create agent');
			}
			
			console.log('✅ Agent created successfully:', result);
		}
		
		// Success - clean up the form
		showCreateForm = false;
		selectedAgent = null;
		resetForm();
		avatarFile = null;
		
		// Reload agents to ensure we have the latest data
		await agentStore.loadAgents();
		updateStatus = 'Agent saved successfully!';
		setTimeout(() => {
			updateStatus = '';
		}, 3000);
		
	} catch (error) {
		console.error('Error saving agent:', error);
		if (error instanceof Error) {
			updateStatus = `Error saving agent: ${error.message}`;
		} else {
			updateStatus = 'Error saving agent. Please try again.';
		}
		// Clear error status after 5 seconds
		setTimeout(() => {
			updateStatus = '';
		}, 5000);
	}
}
$: {
	console.log('=== DEBUG AVAILABLE MODELS ===');
	console.log('Total availableModels:', availableModels.length);
	
	// Group by provider to see duplicates
	const grouped = availableModels.reduce((acc, model) => {
		if (!acc[model.provider]) acc[model.provider] = [];
		acc[model.provider].push({ id: model.id, name: model.name, api_type: model.api_type });
		return acc;
	}, {} as Record<string, any[]>);
	
	Object.entries(grouped).forEach(([provider, models]) => {
		console.log(`${provider}:`, models.length, 'models');
		models.forEach(m => console.log(`  - ${m.name} (${m.id}) [${m.api_type}]`));
		
		// Check for duplicates within provider
		const duplicates = models.filter((model, index) => 
			models.findIndex(m => m.api_type === model.api_type) !== index
		);
		if (duplicates.length > 0) {
			console.log(`  ⚠️ DUPLICATES in ${provider}:`, duplicates);
		}
	});
	console.log('================================');
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
	  const getText = (key: string): string => $t(key) as string;
  
</script>

<div class="agents-config">
	<div 
	class="column agents-column"
	class:shrink={showCreateForm}
	>
		<!-- <hr> -->
		{#if isLoading}
			<LoadingSpinner />
		{:else if filteredAgents.length === 0}
			<p>No agents found. Create a new agent to get started.</p>
		{:else}
			<div class="search-and-sort-container">
				<div class="search-container">
					<Icon name="Search" size={24} />
				<input type="text" bind:value={searchQuery} placeholder={`${getText('nav.search')} ${getText('nav.agents')}`} />
				</div>
				<div class="options">
					<button class="filter-toggle-button" on:click={toggleFilters} class:active={showFilters}>
						<Icon name="Filter" size={24} />
						{showFilters ? 'Hide' : 'Filters'}
					</button>
					<div class="sort-container">
						<select bind:value={sortOption}>
							{#each sortOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					<!-- <h2>Agents</h2> -->
					{#if !showCreateForm}
						<button class="create-button" on:click={showCreate}>
							<Icon name="Plus" size={24} />
						</button>
					{/if}
				</div>
			</div>
			<div class="button-grid" transition:fade={{ duration: 300 }}>
				{#each filteredAgents as agent (agent.id)}
					{#if showCreateForm}

								<button class="mini-button" on:click={() => showEdit(agent)}>
								
															<div class="avatar-container">
								{#if agent.avatar}
									<img src={getAgentAvatarUrl(agent)} alt="Agent avatar" class="avatar" />
								{:else}
									<div class="avatar-placeholder">
										<Icon name="Bot" size={20} />
									</div>
								{/if}
					</div>

								</button>
					{:else}
					<div class="agent-item">
						<div class="agent-wrapper">
							<div class="avatar-container">
								{#if agent.avatar}
									<img src={getAgentAvatarUrl(agent)} alt="Agent avatar" class="avatar" />
								{:else}
									<div class="avatar-placeholder">
										<Icon name="Bot" size={20} />
									</div>
								{/if}
							</div>
							<div class="name-container">
								<div class="status-badge {agent.status}">{agent.status}</div>
								<div class="agent-name">{agent.name}</div>
							</div>
						</div>

						<div class="container-row">
							<div class="data-counts">
								<button class="delete-button" on:click={() => handleDelete(agent)}>
									<Icon name="Trash2" size={16} />
								</button>
								<button class="mini-button" on:click={() => showEdit(agent)}>
									<Icon name="Settings" size={16} />
								</button>
								<button class="mini-button" on:click={() => showGenerator(agent)}>
									<Icon name="RefreshCcw" size={16} />
								</button>
							</div>
							<div class="action-buttons">
								<button class="delete-button" on:click={() => handleDelete(agent)}>
									<Icon name="Trash2" size={16} />
								</button>
								<button class="mini-button" on:click={() => showEdit(agent)}>
									<Icon name="Settings" size={16} />
								</button>
								<button class="mini-button" on:click={() => showGenerator(agent)}>
									<Icon name="RefreshCcw" size={16} />
								</button>
							</div>
						</div>
					</div>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- <p>Configure your agents to handle different types of tasks.</p> -->
	</div>
	<div class="bottom-container">
		{#if showFilters}
			<div class="filter-section" transition:fade={{ duration: 300 }}>
				<div class="filter-container">
					<div class="filter-group">
						<div class="filter-row">
							<button
								class="filter-button"
								class:active={!selectedRole}
								on:click={() => (selectedRole = null)}
							>
								Reset roles
							</button>
							{#each roles as role}
								<button
									class="filter-button"
									class:active={selectedRole === role}
									on:click={() => (selectedRole = role)}
								>
									<Icon name={roleIcons[role]} size={24} />
									<span>{role}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="filter-group">
						<div class="filter-row">
							<button
								class="filter-button"
								class:active={!selectedStatus}
								on:click={() => (selectedStatus = null)}
							>
								Reset
							</button>
							{#each statuses as status}
								<button
									class="filter-button status-{status}"
									class:active={selectedStatus === status}
									on:click={() => (selectedStatus = status)}
								>
									<Icon name={statusIcons[status]} size={16} />
									{#if selectedStatus == status}
										<span>{status}</span>
									{/if}
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
								<div class="button-group">
				<button class="cancel-button" on:click={handleCancel}>
					<Icon name="ArrowLeft" size={24} />
				</button>

			</div>

<div class="agent-header-wrapper">
					<div class="avatar-upload" on:click={triggerAvatarUpload}>
						<div class="avatar-preview">
							{#if avatarFile}
								<img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" />
							{:else if selectedAgent && selectedAgent.avatar}
								<img src={getAgentAvatarUrl(selectedAgent)} alt="Current avatar" />
							{:else}
								<Icon name="Bot" size={16} />
							{/if}
						</div>
						<div class="upload-overlay">
							<Icon name="Upload" size={16} />
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
								<div class="button-group">

				<button class="submit-button" on:click={handleSubmit}>
					{#if selectedAgent}
						<Icon name="RefreshCcw" size={24} />
					{:else}
						<Icon name="Save" size={24} />
					{/if}
				</button>

			</div>
				</div>

				<div class="form-group input">
					<label for="agentPrompt">PROMPT</label>
					<textarea id="agentPrompt" bind:value={agentPrompt} placeholder="Enter agent prompt..."
					></textarea>
				</div>
				<hr />
				<div class="form-group input">
					<label for="agentName">NAME</label>
					<input
						type="text"
						id="agentName"
						bind:value={agentName}
						placeholder="Enter agent name..."
					/>
				</div>

				<div class="form-group input">
					<label for="agentDescription">DESCRIPTION</label>
					<textarea
						id="agentDescription"
						bind:value={agentDescription}
						placeholder="Enter agent description..."
					></textarea>
				</div>

				<div class="form-group input">
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

				<div class="form-group models">
					<label>MODEL</label>

					<!-- Provider Tabs -->
<!-- Replace the existing MODEL section in your form with this updated version -->
<div class="form-group models">
	<label>MODEL</label>

	<!-- Provider Tabs -->
	<div class="provider-tabs">
		{#each providers as provider (provider)}
			<button
				type="button"
				class="provider-tab"
				class:active={selectedProvider === provider}
				on:click={() => selectProvider(provider)}
			>
				{#if provider === 'local'}
					Local
					{#if isLoadingLocalModels}
						<Icon name="Loader2" size={12} />
					{:else if localServerStatus === 'offline'}
						<Icon name="AlertCircle" size={12}  />
					{:else if localServerStatus === 'online'}
						<Icon name="CheckCircle" size={12}  />
					{/if}
				{:else}
					{provider.charAt(0).toUpperCase() + provider.slice(1)}
				{/if}
			</button>
		{/each}
	</div>

	<!-- Models for Selected Provider -->
	{#if selectedProvider === 'local'}
		{#if localServerStatus === 'offline'}
			<div class="local-server-offline">
				<div class="offline-message">
					<Icon name="AlertTriangle" size={20} />
					<div>
						<strong>Local Server Offline</strong>
						<p>Make sure your local AI server (like Ollama) is running on http://localhost:11434</p>
						<button
							type="button"
							class="retry-button"
							on:click={loadLocalModels}
						>
							Retry connection
						</button>
					</div>
				</div>
			</div>
		{:else if isLoadingLocalModels}
			<div class="spinner-container">
					<div class="spinner"></div>
			</div>
		{:else}
			<div class="models-grid">
				{#each localModels as model (model.id)}
					<button
						type="button"
						class="model-button"
						class:selected={agentModel.includes(model.id)}
						on:click={() => toggleModel(model.id)}
					>
						<span class="model-name">{model.name}</span>
						<span class="model-description">
							{model.parameters ? `${model.parameters} params` : 'Local model'}
						</span>
						<span class="badge-wrapper">
						<span class="model-provider-badge">
							<!-- <Icon name="Brain" size={12} /> -->
							{$t('chat.local')}
						</span>
						</span>

					</button>
				{:else}
					<div class="no-models">
						No local models available
					</div>
				{/each}
			</div>
			
			{#if localModels.length > 0}
				<div class="models-footer">
					<span class="models-count">
						{localModels.length} local model{localModels.length !== 1 ? 's' : ''} available
					</span>
					<button
						type="button"
						class="refresh-models"
						on:click={loadLocalModels}
						disabled={isLoadingLocalModels}
					>
						<!-- <Icon name={isLoadingLocalModels ? "RefreshCcw" : "RefreshCw"} 
							  size={14} 
							 /> -->
						Refresh
					</button>
				</div>
			{/if}
		{/if}
{:else if selectedProvider && modelsByProvider[selectedProvider]}
	<div class="models-grid">
		{#each modelsByProvider[selectedProvider] as model (model.id)}
			<button
				type="button"
				class="model-button"
				class:selected={agentModel.includes(model.id)}
				on:click={() => toggleModel(model.id)}
			>
				<span class="model-name">{model.name}</span>
				{#if model.description}
					<span class="model-description">{model.description}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}
</div>
					<!-- Models for Selected Provider -->
					<!-- {#if selectedProvider && modelsByProvider[selectedProvider]}
						<div class="models-grid">
							{#each modelsByProvider[selectedProvider] as model (model.id)}
								<button
									type="button"
									class="model-button"
									class:selected={agentModel.includes(model.id)}
									on:click={() => toggleModel(model.id)}
								>
									<span class="model-name">{model.name}</span>
									{#if model.description}
										<span class="model-description">{model.description}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if} -->
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
								<h4>
									{action.name}
								</h4>
								{action.description}
							</button>
						{/each}
					</div>
				</div>

<div class="form-group">
	<label>ROLE *</label>
	<div class="role-selection">
		{#each roles as role}
			<label class="role-option">
				<input 
					type="radio" 
					bind:group={selectedRole} 
					value={role}
					name="agent-role"
				/>
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
							bind:value={tagInput}
							on:keydown={handleKeydown}
						/>
					</div>
					<div class="tag-list">
						{#each selectedTags as tag}
							<span class="tag">{tag} <button on:click={() => removeTag(tag)}>×</button></span>
						{/each}
					</div>
				</div>
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
								<Icon name="Bot" size={48} />
							{/if}
						</div>
						<div class="upload-overlay">
							<Icon name="Upload" size={24} />
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
	.agents-config {
		display: flex;
		gap: 0;
		z-index: 1000;
		width: auto;
		backdrop-filter: blur(20px);
	}

	.column {
		display: flex;
		flex-direction: column;
		/* width: 500px; */
		justify-content: center;
		align-items: center;
	}

	.agents-column {
		display: flex;
		flex-direction: column;
		/* align-items: flex-start; */
		height: 100%;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--secondary-color) transparent;
		transition: all 0.3s ease;
		&.shrink {

			justify-content: center;
			width: auto;
			& .button-grid {
				width: auto;
				margin-left: 0;
				& .mini-button {
					transition: all	0.3s ease;
					&:hover {
						transform: scale(0.9);
						background: var(--tertiary-color);
						border-radius: 1rem;
					}
				}
				& button.model-button {
					&:hover {
						transform: scale(1.1);
					};
				}
			}
			& .search-and-sort-container {
				display: none;
			}
		}
	}
	.badge-wrapper {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
	}
	.model-provider-badge {
		display: flex;
		background: var(--primary-color);
		border-radius: 1rem;
		padding: 0 0.5rem;
		

		font-size: 0.7rem;
		color: var(--placeholder-color);
	}	
	.form-column {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		position: relative;
		/* padding: 20px; */
		height: calc(100% - 6rem);
		width: 100%;
		top: 0;

		background: var(--bg-gradient-r);
		overflow-y: hidden;

		border: 1px solid var(--line-color);
		/* width: auto; */

		/* width: 70vh; */
	}

	.form-content {
		/* background: linear-gradient(to bottom, #2c3e50, #4ca1af);  */
		/* background: linear-gradient(to bottom, #e6f3ff, #759ca2); */
		background-color: transparent;

		/* border-left: 3px solid #323232;
		border-bottom: 3px solid #323232;
		border-top: 3px solid #323232; */
		/* height: 80vh; */
		display: flex;
		flex-direction: column;
		width: 90%;
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
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		z-index: 1000;
	}
	.form-group.input {
		display: flex;
		flex-direction: row !important;
		width: 100%;
		& input {
			width: 100%;
		}
		& label {
			position: absolute;
			transform: translateY(-0.75rem);
			color: var(--placeholder-color);
		}
	}
	.form-group.models {
		flex-direction: column !important;
	}
	.form-group label {
		display: flex;
		width: auto !important;
		max-width: 200px;
		margin: 0;
		padding: 0;
		margin-bottom: 0.5rem;
		font-weight: 600;
		font-size: 0.7rem;
		color: var(--text-color);
	}

	.agent-header-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: center;
		width: auto;
		flex: 1;

	}

	.provider-tabs {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 0.5rem;
	}

	.provider-tab {
		display: flex;
		flex-grow: 1;

		flex-direction: row;
		width: auto;
		padding: 0.5rem 1rem;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		border-radius: 1rem;
		color: var(--placeholder-color);
		opacity: 0.5;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.provider-tab:hover {
		background: var(--secondary-color);
		border-color: var(--primary-color);
	}

	.provider-tab.active {
		background: var(--primary-color);
		border-color: var(--primary-color);
		color: white;
		opacity: 1;
	}
	.models-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		align-items: stretch;
		gap: 0.5rem;
		max-height: 200px;
		overflow-x: auto;
	}

	.model-button {
		padding: 0.5rem;
		background: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 0.5rem;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		display: flex;
		flex-grow: 1;
		justify-content: space-between;
		align-items: flex-start;
		flex-direction: column;
		gap: 0.25rem;
		width: 100px;
	}

	.model-button:hover {
		background: var(--secondary-color);
		border-color: var(--primary-color);
		transform: translateY(-1px);
	}

	.model-button.selected {
		background: var(--primary-color);
		border-color: var(--primary-color);
		color: white;
	}

	.model-name {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.model-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.3;
	}

	.model-button.selected .model-description {
		opacity: 0.9;
	}
	label {
		display: flex;
		justify-content: space-between;
		font-weight: bold;
		color: var(--placeholder-color);
		font-size: 0.9rem;
	}

	input[type='text'],
	input[type='password'] {
		width: 100%;
		padding: 0.5rem;
		border: none;
		border-radius: 1rem;
		font-size: 1rem;
		color: var(--text-color);
		background-color: var(--primary-color);
	}

	@supports (-webkit-appearance: none) {
		select {
			-webkit-appearance: none;
			appearance: none;
			background: var(--secondary-color);
			background-size: 1.25rem !important;
		}
	}
	select {
		padding: 0 0.5rem;
		border: 1px solid var(--line-color);
		background: var(--bg-color);
		color: var(--text-color);
		font-size: 1rem;
		width: auto;
		height: 2rem;
		border-radius: 1rem;
		transition: all 0.3s ease-in;
		&:hover {
			background: var(--secondary-color);
			cursor: pointer;
		}
	}

	textarea {
		/* height: 100px; */
		width: 100%;
		padding: 0.5rem;
		border: none;
		font-size: 1rem;
		background: var(--primary-color);
		resize: none;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		border-radius: 1rem;
		color: var(--text-color);
	}

	.button-grid {
		display: flex;
		flex-direction: column;
		height: auto;
		width: calc(100% - 2rem);
		margin-left: 1rem;
		// width: calc(100% - 2rem);
		// width: calc(100% - 2rem);
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		/* border-radius: 12px; */
		/* max-width: 300px; */
		/* background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 90%); */
		// box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Adds a soft shadow for depth */
		overflow-y: scroll;
		overflow-x: hidden;

		&::-webkit-scrollbar {
			width: 0.25rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}

		/* max-height: 80vh; Limits the height to prevent excessive scrolling */
	}

	.button-group {
		display: flex;
		flex-direction: row;
		justify-content: center;
		position: relative;
		bottom: 0;
		gap: 10px;
		/* margin-top: 20px; */
		width: auto;
		z-index: 0;
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


	.submit-button, .cancel-button {
		gap: 5px;
		padding: 5px;
		background-color: var(--primary-color);
		color: gray;
		border: 2px solid #4b4b4b;
		border-radius: 14px;
		cursor: pointer;
		transition: background-color 0.3s;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		display: flex;
		right: 0;
	}

	.submit-button:hover {
		background-color: #45a049;
		color: white;
	}

	.create-button {
		background-color: var(--secondary-color);
		color: var(--tertiary-color);
		display: flex;
		align-items: center;
		padding: 0;
		justify-content: center;
		border-radius: 50%;
		border: none; /* Optional */
		padding: 0.5rem;
		width: 2rem;
		height: 2rem;
		cursor: pointer;
	}

	.create-button:hover {
		background: var(--primary-color);
	}

	.container-row {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		/* margin-right: 50px; */
		align-items: flex-start;
		margin-right: 0.5rem;
		width: auto;
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
		border: 1px solid var(--line-color);
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
		/* height: 340px; */
		justify-content: flex-start;
		align-items: center;
		gap: 1rem;
		width: auto;

		/* border-bottom: 2px solid rgb(84, 84, 84); */
		background-color: var(--primary-color);
		border: 1px solid var(--line-color);
		border-radius: 1rem;
		padding: 0.5rem 0;
		/* height: 200px; */
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		/* padding: 20px; */
		transition: all 1.8s cubic-bezier(0.075, 0.82, 0.165, 1);
		opacity: 0.7;
	}

	.agent-item:hover {
		/* background-color: #f0f0f0; */
		/* transform: scale(0.95); */
		border: 1px solid lightblue;
		cursor: pointer;
		opacity: 1;
	}
	.action-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		& .action-button {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-items: flex-start;
			padding: 0.5rem;
			margin: 0;
			width: 100%;
			height: auto;
			text-align: left;
			background: var(--bg-color);
			&:hover {
				background: var(--primary-color);
			}

			& h4 {
				color: var(--tertiary-color);
				margin: 0;
				padding: 0;
				width: 100%;
			}
		}
	}
	.delete-button,
	.mini-button {
		background-color: transparent;
		color: rgb(202, 202, 202);
		padding: 0;
		border: none;
		border-radius: 0px;
		cursor: pointer;
		height: auto;
		width: auto;
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
		margin: 0;
	}

	.header-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		margin: 0;
		padding: 0;
	}

	.avatar-container {
		width: 60px !important;
		/* height: 100%; */
		height: 60px !important;
		// margin-left: 0.5rem;
		border-radius: 50%;
		/* scale: 1.5; */
		justify-content: center;
		align-items: center;
		overflow: hidden;
		background-color: var(--primary-color);

		/* margin-right: 1rem; */
	}

	.avatar {
		width: 100%;
		height: 100%;
		/* border-radius: 20px; */
		/* margin-left: 5%; */
		justify-content: center;
		align-items: center;

		/* width: 100px; */
		/* height: 100%; */
		/* object-fit: cover; */
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		/* background-color: #e0e0e0; */
		color: var(--tertiary-color);
	}
	.agent-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		gap: 0.5rem;
		width: 100%;
	}
	.name-container {
		display: flex;
		flex-direction: column;
		width: 100px;
		height: 100%;

		justify-content: flex-start;
	}

	.status-badge {
		position: relative;
		display: flex;
		flex-direction: row;
		width: auto;

		margin-left: 0;
		text-align: left;
		align-items: center;
		justify-content: left;
		border-radius: 10px;
		font-size: 12px;
		font-weight: bold;
		color: white;
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
		display: flex;
		gap: 0.5rem;
		height: 50%;
		width: auto;
		justify-content: flex-end;
	}

	.action-buttons {
		display: none;
	}

	.search-container {
		/* position: fixed; */
		justify-content: center;
		align-items: center;
		display: flex;

		color: var(--text-color);
		/* width: calc(100vh - 40px); */
		/* height: 50px; */
		flex-direction: row;
		gap: 0.5rem;
		z-index: 1002;
		width: calc(100% - 1rem);
	}

	.sort-container {
		display: flex;
		height: auto;
		padding: 0;
		margin: 0;
		/* align-items: center; */
		/* margin-bottom: 10px; */
		/* width: 50%;; */
	}

	.options {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		width: calc(100% - 1rem);
		height: auto;
	}

	.filter-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		left: 0;
		bottom: 5rem;
		position: absolute;
		width: calc(50% - 80px);
		/* padding: 20px; */
	}

	.filter-section h4 {
		margin-bottom: 10px;
		color: #ffffff;
	}

	.filter-container {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
	}

	.filter-row {
		display: flex;
		justify-content: flex-start;
		align-items: flex-start;
		padding: 0.5rem;
	}

	.filter-button,
	.tag-button {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		width: auto !important;
		padding: 0.25rem;
		margin-left: 0.25rem;
		margin-right: 0.25rem;
		cursor: pointer;
		transition: all 0.3s ease;
		color: var(--placeholder-color);
		user-select: none;
		font-size: 0.8rem;

		background-color: var(--bg-color);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.3s ease;
		/* width: 50%; */
	}

	.filter-button:hover,
	.tag-button:hover {
		background-color: var(--primary-color);
		color: var(--text-color);
	}

	.filter-button.active,
	.tag-button.active {
		background-color: var(--secondary-color);
		color: var(--tertiary-color);
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
		width: 3rem;
		height: 3rem;
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
		background-color: var(--primary-color);
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
		position: relative;
		justify-content: center;
		width: calc(100% - 2rem);
		gap: 0.5rem;
		left: 0;
		bottom: 0;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		margin: 0;
		align-items: center;
		/* width: 100%; */
	}

	.bottom-container {
		position: absolute;
		justify-content: left;
		align-items: left;
		bottom: 0;
		left: 0;
		color: gray;
		/* width: calc(100vh - 40px); */
		/* height: 50px; */
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 10px;
		background-color: #1f1f1f;
		z-index: 1002;
		/* width: 40%; */
		background-color: transparent;
		/* background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0)); */
		border-radius: 20px;
		width: calc(100% - 90px);
	}

	.agent-name {
		color: white;
		font-size: 16px;
		margin-top: 10px;
	}

	.filter-toggle-button {
		/* display: flex; */
		/* align-items: center; */
		gap: 5px;
		padding: 0.5rem 1rem;
		height: 2rem;
		background-color: var(--secondary-color);
		color: var(--placeholder-color);
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.3s;
		width: 100px;
	}

	.filter-toggle-button:hover {
		background: var(--primary-color);
	}

	.filter-toggle-button.active {
		background-color: var(--tertiary-color);
	}

	.filter-group {
		display: flex;
		flex-direction: row;
		justify-content: center;
		gap: 0.5rem;
		/* border-left: 1px solid #4b4b4b; */
		flex: 0;
		backdrop-filter: blur(10px);
	}

	.filter-row,
	.tag-filter {
		display: flex;
		flex-direction: row;
		width: auto;
		flex-wrap: wrap;
		justify-content: flex-start;
		align-items: stretch;
		gap: 0.5rem;
		background: var(--secondary-color);
		border-radius: 1rem;
	}

	p {
		color: #ffffff;
		font-size: 20px;
		padding: 20px;
	}

	@media (max-width: 1700px) {
	}

	@media (max-width: 750px) {
		.agent-item {
			width: 70px;
			/* border-radius: 50%; */
		}

		.agent-name {
			display: none;
			font-size: 12px;
			justify-content: flex-end;
			align-items: center;
		}

		.avatar-container {
			width: 70px;
			height: 70px;
		}

		.button-row {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}

		.button-grid {
			gap: 20px;
			/* padding: 20px; */
			border-radius: 12px;
			background-color: #333333;
			/* background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 90%); */
			box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Adds a soft shadow for depth */
			overflow-y: auto;
			overflow-x: hidden;
			max-height: 80vh; /* Limits the height to prevent excessive scrolling */
		}

		.search-container {
			width: 90%;
			left: 5%;
		}
	}
</style>
