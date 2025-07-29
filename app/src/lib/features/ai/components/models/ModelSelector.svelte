<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import type { AIModel, ProviderType, SelectableAIModel} from '$lib/types/types';
	import { fly } from 'svelte/transition';
	import { defaultModel, getRuntimeDefaultModel } from '$lib/features/ai/utils/models';
	import APIKeyInput from '$lib/features/ai/components/models/APIKeyInput.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { get } from 'svelte/store';
	import { providers } from '$lib/features/ai/utils/providers';
	import { modelStore } from '$lib/stores/modelStore';
	import { currentUser } from '$lib/pocketbase';
	import { fetchTryCatch, clientTryCatch, isSuccess } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { t } from '$lib/stores/translationStore';

	export let provider: string;

	export let expandedModelList: ProviderType | null = null;

export let selectedModel: SelectableAIModel | null = null;

	let isInitialized = false;
	let isLoadingPreferences = true;
	let isLoadingModels = false;
	let key = '';
let favoriteModels: SelectableAIModel[] = [];
	let userModelPreferences: string[] = [];
	let favoritesInitialized = false;
	let currentProvider: ProviderType | null = null;
	let showAPIKeyInput = false;
	let isOffline = false;
	let availableProviderModels: Record<ProviderType, SelectableAIModel[]> = {
		openai: [],
		anthropic: [],
		google: [],
		grok: [],
		deepseek: [],
		local: []
	};
let localModels: SelectableAIModel[] = [];
let localServerStatus: 'online' | 'offline' | 'unknown' = 'unknown';
let isLoadingLocalModels = false;

	const dispatch = createEventDispatcher<{
		submit: string;
		close: void;
	select: SelectableAIModel;
		toggleFavorite: { modelId: string; isFavorite: boolean };
	}>();
	modelStore.subscribe((state) => {
		isOffline = state.isOffline;
	});
const enhancedProviders = {
	...providers,
	local: {
		name: $t('chat.local') + ' ' + $t('chat.models'),
		icon: '/icons/server.svg', // or any existing icon path
		baseURL: 'http://localhost:11434',
		fetchModels: async () => []
	}
};
	function handleSubmit(e: Event) {
		e.preventDefault();
		if (key.trim()) {
			dispatch('submit', key.trim());
			key = '';
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (e.currentTarget === e.target) {
			expandedModelList = null;
		}
	}

	async function handleDeleteAPIKey(provider: ProviderType) {
		if (!$currentUser) return;

		const confirmed = confirm(
			`Are you sure you want to delete your ${providers[provider].name} API key?`
		);
		if (!confirmed) return;

		const result = await clientTryCatch(apiKey.deleteKey(provider));

		if (isSuccess(result)) {
			availableProviderModels[provider] = [];

			if (expandedModelList === provider) {
				expandedModelList = null;
				currentProvider = null;
				showAPIKeyInput = false;
			}

			updateFavoriteModels();

			console.log(`Successfully deleted API key for ${provider}`);
		} else {
			console.error(`Error deleting API key for ${provider}:`, result.error);
			alert(`Failed to delete API key: ${result.error}`);
		}
	}

async function handleProviderClick(key: string) {
	const provider = key as ProviderType;
	
	// Handle local provider separately
	if (isLocalProvider(key)) {
		await handleLocalProviderClick();
		return;
	}
	
	// Rest of your existing logic for other providers
	const currentKey = get(apiKey)[provider];

	console.log(`Clicked provider: ${provider}, has key: ${Boolean(currentKey)}`);

	if (currentProvider === provider) {
		currentProvider = null;
		expandedModelList = null;
		return;
	}

	currentProvider = provider;
	expandedModelList = provider;

	if (!currentKey) {
		console.log(`No API key found for ${provider}, showing input form`);
		showAPIKeyInput = true;
	} else if ($currentUser) {
		isLoadingModels = true;
		try {
			await clientTryCatch(modelStore.setSelectedProvider($currentUser.id, provider));
			await loadProviderModels(provider);
			showAPIKeyInput = false;
		} catch (error) {
			console.warn('Error setting provider:', error);
		} finally {
			isLoadingModels = false;
		}
	}
}

function createAIModelFromSelectable(selectableModel: SelectableAIModel): AIModel {
	// For local models, we don't save them to the database, just create a minimal AIModel structure
	if (selectableModel.provider === 'local') {
		return {
			id: selectableModel.id,
			name: selectableModel.name,
			provider: selectableModel.provider,
			api_key: '', // Local models don't need API keys
			base_url: 'http://localhost:11434',
			api_type: selectableModel.api_type || selectableModel.id,
			api_version: 'v1',
			description: selectableModel.description || '',
			user: [],
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			collectionId: '',
			collectionName: 'local_models'
		} as AIModel;
	}
	
	// For non-local models, they should already be proper AIModels from the providers
	return selectableModel as AIModel;
}

// Update your handleModelSelection function
async function handleModelSelection(model: SelectableAIModel) {
	const enrichedModel: SelectableAIModel = {
		...model,
		provider: model.provider
	};

	console.log('Selected model with provider:', enrichedModel.provider);

	if ($currentUser) {
		try {
			// Special handling for local models - don't save to database
			if (model.provider === 'local') {
				// For local models, just update the local state
				selectedModel = enrichedModel;
				currentProvider = model.provider as ProviderType;
				
				// You might want to save the selection preference without saving the model itself
				try {
					await modelStore.setSelectedProvider($currentUser.id, 'local');
					console.log('Set selected provider to local');
				} catch (error) {
					console.warn('Error setting local provider:', error);
				}
			} else {
				// For non-local models, use the existing store logic
				const aiModel = createAIModelFromSelectable(enrichedModel);
				const success = await modelStore.setSelectedModel($currentUser.id, aiModel);
				if (success) {
					selectedModel = enrichedModel;
					console.log('Saved model selection to model store');
					currentProvider = model.provider as ProviderType;
				}
			}
		} catch (error) {
			console.warn('Error selecting model:', error);
		}
	} else {
		selectedModel = enrichedModel;
		currentProvider = model.provider as ProviderType;
	}

	expandedModelList = null;
	dispatch('select', enrichedModel);
}

async function loadProviderModels(provider: ProviderType) {
	isLoadingModels = true;
	try {
		const currentKey = get(apiKey)[provider];
		console.log(`Loading models for ${provider}, has key: ${Boolean(currentKey)}`);

		if (currentKey) {
			const providerModelList = await providers[provider].fetchModels(currentKey);
			
			// Convert to SelectableAIModel format
			availableProviderModels[provider] = (providerModelList || []).map((model): SelectableAIModel => ({
				id: model.id,
				name: model.name,
				provider: provider,
				description: model.description,
				context_length: model.context_length,
				// description: model.description || `Local model: ${model.name}`,
				api_type: model.api_type,
				size: model.size,
				parameters: model.parameters,
				families: model.families || [],
				available: true
			}));
			
			console.log(`Loaded ${availableProviderModels[provider].length} models for ${provider}`);
		} else {
			availableProviderModels[provider] = [];
			console.warn(`No API key available for ${provider}`);
		}
	} catch (error) {
		console.error(`Error fetching models for ${provider}:`, error);
		availableProviderModels[provider] = [];
	} finally {
		isLoadingModels = false;
	}
}

	async function handleAPIKeySubmit(event: CustomEvent<string>) {
		if (currentProvider) {
			console.log(`Saving new API key for ${currentProvider}`);
			await apiKey.setKey(currentProvider, event.detail);
			showAPIKeyInput = false;
			await loadProviderModels(currentProvider);
		}
	}

	function updateFavoriteModels() {
		favoriteModels = [];

		Object.entries(availableProviderModels).forEach(([providerKey, models]) => {
			models.forEach((model) => {
				const modelKey = `${model.provider}-${model.id}`;
				if (userModelPreferences.includes(modelKey)) {
					const favoriteModel = {
						...model,
						provider: providerKey as ProviderType
					};
					favoriteModels.push(favoriteModel);
				}
			});
		});
		favoritesInitialized = true;

		console.log(
			'Updated favorite models:',
			favoriteModels.map((m) => `${m.provider}:${m.name}`)
		);
	}
async function toggleFavorite(model: SelectableAIModel, event: MouseEvent) {
		event.stopPropagation();

		if (!$currentUser) return;

		const modelId = model.id;
		const modelKey = `${model.provider}-${modelId}`;
		const isFavorite = userModelPreferences.includes(modelKey);

		// Update local state first for responsive UI
		if (isFavorite) {
			userModelPreferences = userModelPreferences.filter((id) => id !== modelKey);
		} else {
			userModelPreferences = [...userModelPreferences, modelKey];
		}

		// Update favorite models list
		updateFavoriteModels();

		// Send event to parent
		dispatch('toggleFavorite', { modelId: modelKey, isFavorite: !isFavorite });

		// Save to backend
		try {
			console.log(`Saving model preferences to backend: ${JSON.stringify(userModelPreferences)}`);

			const response = await fetch(`/api/users/${$currentUser.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model_preference: userModelPreferences
				})
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				console.error('Failed to update model preferences:', data.error || 'Unknown error');
				// Revert local state if save failed
				if (isFavorite) {
					userModelPreferences = [...userModelPreferences, modelKey];
				} else {
					userModelPreferences = userModelPreferences.filter((id) => id !== modelKey);
				}
				updateFavoriteModels();
			} else {
				console.log('Successfully updated model preferences');
			}
		} catch (error) {
			console.error('Error saving model preference:', error);
			// Revert local state on error
			if (isFavorite) {
				userModelPreferences = [...userModelPreferences, modelKey];
			} else {
				userModelPreferences = userModelPreferences.filter((id) => id !== modelKey);
			}
			updateFavoriteModels();
		}
	}

	async function loadUserModelPreferences() {
		if (!$currentUser) {
			favoritesInitialized = true;
			isLoadingPreferences = false;
			return;
		}

		isLoadingPreferences = true;

		try {
			const response = await fetch(`/api/users/${$currentUser.id}`);
			const data = await response.json();

			if (data.success && data.user && data.user.model_preference) {
				userModelPreferences = Array.isArray(data.user.model_preference)
					? data.user.model_preference
					: [];
				console.log('Loaded user model preferences:', userModelPreferences);
			} else {
				console.log('No model preferences found or unable to parse preferences');
				userModelPreferences = [];
			}
		} catch (error) {
			console.error('Error loading user model preferences:', error);
			userModelPreferences = [];
		} finally {
			// Always mark as initialized when done, regardless of success/failure
			favoritesInitialized = true;
			isLoadingPreferences = false;
		}
	}
	function loadAllAvailableProviderModels() {
		return Promise.all(
			Object.keys(providers).map(async (providerKey) => {
				const provider = providerKey as ProviderType;
				const currentKey = get(apiKey)[provider];
				if (currentKey) {
					await loadProviderModels(provider);
				}
			})
		);
	}

async function loadLocalModels() {
	isLoadingLocalModels = true;
	try {
		console.log('Loading local models...');
		
		const result = await clientTryCatch(
			fetch('/api/ai/local/models').then((r) => r.json()),
			'Failed to fetch local AI models'
		);

		if (result.success && result.data.success) {
			const data = result.data.data;
			localServerStatus = data.server_info?.status === 'connected' ? 'online' : 'offline';
			
			// Convert local models to AIModel format
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
				// Add any other properties you need
			}));
			
			// Update the available models for local provider
			availableProviderModels.local = localModels;
			
			console.log(`Loaded ${localModels.length} local models, status: ${localServerStatus}`);
		} else {
			console.warn('Failed to load local models:', result.error || 'Unknown error');
			localServerStatus = 'offline';
			localModels = [];
			availableProviderModels.local = [];
		}
	} catch (error) {
		console.error('Error loading local models:', error);
		localServerStatus = 'offline';
		localModels = [];
		availableProviderModels.local = [];
	} finally {
		isLoadingLocalModels = false;
	}
}
// Handle local provider click (no API key needed)
async function handleLocalProviderClick() {
	console.log('Clicked local provider');
	
	if (currentProvider === 'local') {
		currentProvider = null;
		expandedModelList = null;
		return;
	}

	currentProvider = 'local';
	expandedModelList = 'local';
	showAPIKeyInput = false; // Local doesn't need API key
	
	// Load local models
	await loadLocalModels();
	
	// Set selected provider in store if user is logged in
	if ($currentUser) {
		try {
			await clientTryCatch(modelStore.setSelectedProvider($currentUser.id, 'local'));
		} catch (error) {
			console.warn('Error setting local provider:', error);
		}
	}
}

// Check if provider is local
function isLocalProvider(providerKey: string): boolean {
	return providerKey === 'local';
}

// Get provider status icon for local
function getLocalProviderStatus(): 'success' | 'error' | 'loading' {
	if (isLoadingLocalModels) return 'loading';
	if (localServerStatus === 'online') return 'success';
	return 'error';
}
$: {
	console.log('🔍 DEBUG - Providers object keys:', Object.keys(providers));
	console.log('🔍 DEBUG - "local" in providers:', 'local' in providers);
	console.log('🔍 DEBUG - providers.local:', providers.local);
}

$: {
	console.log('🔍 DEBUG - localServerStatus:', localServerStatus);
	console.log('🔍 DEBUG - localModels length:', localModels.length);
	console.log('🔍 DEBUG - availableProviderModels.local length:', availableProviderModels.local?.length);
}

$: {
	console.log('🔍 DEBUG - currentProvider:', currentProvider);
	console.log('🔍 DEBUG - expandedModelList:', expandedModelList);
	console.log('🔍 DEBUG - isLocalProvider("local"):', isLocalProvider('local'));
}

$: {
	console.log('🔍 DEBUG - isLoadingLocalModels:', isLoadingLocalModels);
	console.log('🔍 DEBUG - getLocalProviderStatus():', getLocalProviderStatus());
}

$: {
	console.log('🔍 DEBUG - Object.entries(providers) includes local:', 
		Object.entries(providers).some(([key]) => key === 'local'));
	console.log('🔍 DEBUG - All provider keys:', 
		Object.entries(providers).map(([key]) => key));
}
$: {
	if (expandedModelList === 'local') {
		console.log('🔍 DEBUG - Local model template should render');
		console.log('🔍 DEBUG - availableProviderModels.local:', availableProviderModels.local);
		console.log('🔍 DEBUG - localServerStatus:', localServerStatus);
		console.log('🔍 DEBUG - isLoadingLocalModels:', isLoadingLocalModels);
	}
}
$: {
	console.log('🔍 DEBUG - Full providers object structure:');
	console.log(JSON.stringify(providers, null, 2));
	console.log('🔍 DEBUG - Provider keys:', Object.keys(providers));
	console.log('🔍 DEBUG - Object.entries(providers):');
	Object.entries(providers).forEach(([key, provider]) => {
		console.log(`  ${key}:`, provider.name);
	});
}

onMount(async () => {
	// Set runtime default model first
	if (!selectedModel) {
		try {
			selectedModel = await getRuntimeDefaultModel();
			console.log('🎯 Set runtime default model:', selectedModel);
		} catch (error) {
			console.error('Error setting runtime default:', error);
			// Fallback to static default converted to SelectableAIModel
			selectedModel = {
				id: defaultModel.id,
				name: defaultModel.name,
				provider: defaultModel.provider,
				api_type: defaultModel.api_type,
				description: defaultModel.description
			};
		}
	}

	if ($currentUser) {
		console.log('Loading API keys and preferences on component mount...');

		await loadUserModelPreferences();
		await apiKey.ensureLoaded();

		// Load local models (no API key required)
		await loadLocalModels();

		const availableKeys = get(apiKey);
		const availableProviders = Object.entries(availableKeys)
			.filter(([_, key]) => !!key)
			.map(([provider]) => provider);

		// Add local to available providers if server is online
		if (localServerStatus === 'online') {
			availableProviders.push('local');
		}

		if (availableProviders.length > 0) {
			await Promise.all(
				availableProviders
					.filter(provider => provider !== 'local') // Skip local, already loaded
					.map(async (providerKey) => {
						try {
							await loadProviderModels(providerKey as ProviderType);
						} catch (error) {
							console.error(`Error loading models for ${providerKey}:`, error);
						}
					})
			);

			updateFavoriteModels();

			// FIXED: Prioritize local models in auto-selection
			if (!selectedModel || (!availableKeys[selectedModel.provider] && selectedModel.provider !== 'local')) {
				const workingProviders = ['local', 'deepseek', 'anthropic', 'grok']; // LOCAL FIRST!
				let modelToSelect: SelectableAIModel | null = null;

				// Try to find a model from working providers in priority order
				for (const providerKey of workingProviders) {
					const provider = providerKey as ProviderType;
					if (
						(provider === 'local' && localServerStatus === 'online' && availableProviderModels[provider]?.length > 0) ||
						(provider !== 'local' && availableKeys[provider] && availableProviderModels[provider]?.length > 0)
					) {
						modelToSelect = availableProviderModels[provider][0];
						console.log(
							`🎯 Auto-selecting model from preferred provider ${provider}:`,
							modelToSelect
						);
						break;
					}
				}

				// Enhanced fallback logic
				if (!modelToSelect) {
					// First try local even if not in availableProviders
					if (localServerStatus === 'online' && availableProviderModels.local?.length > 0) {
						modelToSelect = availableProviderModels.local[0];
						console.log('🎯 Fallback to local model:', modelToSelect);
					} else {
						// Then try other available providers
						for (const providerKey of availableProviders) {
							const provider = providerKey as ProviderType;
							if (availableProviderModels[provider]?.length > 0) {
								modelToSelect = availableProviderModels[provider][0];
								console.log(
									`🎯 Auto-selecting fallback model from provider ${provider}:`,
									modelToSelect
								);
								break;
							}
						}
					}
				}

				// If we found a model to select, use it
				if (modelToSelect) {
					console.log('🎯 Final auto-selected model:', modelToSelect);
					selectedModel = modelToSelect;
					currentProvider = modelToSelect.provider as ProviderType;

					// FIXED: Handle local models differently in model store
					try {
						if (modelToSelect.provider === 'local') {
							// For local models, just set the provider
							await modelStore.setSelectedProvider($currentUser.id, 'local');
							console.log('🎯 Set selected provider to local');
						} else {
							// For API models, save the full model
							const aiModel = createAIModelFromSelectable(modelToSelect);
							await modelStore.setSelectedModel($currentUser.id, aiModel);
							console.log('🎯 Saved API model to store');
						}
					} catch (error) {
						console.warn('Error saving auto-selected model:', error);
					}

					// Dispatch selection to parent
					dispatch('select', modelToSelect);
				}
			}
		} else {
			// ADDED: No API keys available, try local as primary option
			console.log('🎯 No API keys available, checking local models...');
			if (localServerStatus === 'online' && availableProviderModels.local?.length > 0) {
				selectedModel = availableProviderModels.local[0];
				currentProvider = 'local';
				console.log('🎯 No API keys, using local model:', selectedModel);
				dispatch('select', selectedModel);
			}
		}

		// FIXED: Set initial provider (prioritize local)
		let initialProvider: string = selectedModel?.provider || 'local'; // Default to local first!
		if (initialProvider === 'local' && localServerStatus !== 'online') {
			// Local preferred but not available, find alternative
			if (availableProviders.length > 0) {
				initialProvider = availableProviders[0];
			} else {
				initialProvider = 'deepseek'; // Last resort (not anthropic)
			}
		} else if (initialProvider !== 'local' && !availableKeys[initialProvider] && availableProviders.length > 0) {
			initialProvider = availableProviders[0];
		}

		currentProvider = initialProvider as ProviderType;
		isInitialized = true;
	} else {
		// Load local models even when not logged in
		await loadLocalModels();
		
		// ADDED: Set local model as default for non-logged users if available
		if (localServerStatus === 'online' && availableProviderModels.local?.length > 0) {
			selectedModel = availableProviderModels.local[0];
			currentProvider = 'local';
			console.log('🎯 Guest user using local model:', selectedModel);
			dispatch('select', selectedModel);
		}
		
		favoritesInitialized = true;
		isInitialized = true;
	}
});

</script>

<div class="model-wrapper">
{#if expandedModelList}
	<div
		class="model-overlay"
		on:click={handleClickOutside}
		transition:fly={{ y: -20, duration: 200 }}
	>
		<div class="model-list-container">
			<div class="model-header">
				<h3>
					{expandedModelList ? enhancedProviders[expandedModelList].name : ''} Models 
					{#if isLoadingModels || (expandedModelList === 'local' && isLoadingLocalModels)}
						<!-- Show loading -->
					{:else}
						({expandedModelList ? availableProviderModels[expandedModelList]?.length || 0 : 0})
					{/if}
				</h3>

				<div class="header-actions">
					<!-- Only show delete button for non-local providers that have API keys -->
					{#if expandedModelList && expandedModelList !== 'local' && get(apiKey)[expandedModelList]}
						<button
							class="header-btn"
							on:click|stopPropagation={() =>
								expandedModelList && handleDeleteAPIKey(expandedModelList)}
							title="Delete {expandedModelList ? enhancedProviders[expandedModelList].name : ''} API key"
						>
							<Icon name="Trash2" size={20} />
						</button>
					{/if}

					<!-- Close button -->
					<button class="header-btn" on:click={() => (expandedModelList = null)}>
						<Icon name="XCircle" size={35} />
					</button>
				</div>
			</div>
			<div class="model-wrap">

			<!-- Handle loading states -->
			{#if (expandedModelList === 'local' && isLoadingLocalModels) || (expandedModelList !== 'local' && isLoadingModels)}
				<div class="spinner-container">
					<div class="spinner"></div>
					<p>Loading models...</p>
				</div>
			<!-- Handle API key input for non-local providers -->
			{:else if expandedModelList !== 'local' && showAPIKeyInput}
				<div class="api-key-container">
					<h4>Enter {enhancedProviders[expandedModelList].name} API Key</h4>
					<APIKeyInput provider={expandedModelList} on:submit={handleAPIKeySubmit} />
				</div>
			<!-- Show models if available -->
			{:else if availableProviderModels[expandedModelList]?.length > 0}
				<div class="model-list">
					{#each availableProviderModels[expandedModelList] as model}
						<button
							class="model-button"
							class:model-selected={selectedModel && selectedModel.id === model.id && selectedModel.provider === model.provider}
							on:click={() => handleModelSelection(model)}
						>
							<span
								class="star-button"
								class:star-active={userModelPreferences.includes(`${model.provider}-${model.id}`)}
								on:click={(e) => toggleFavorite(model, e)}
							>
								<Icon name="Star" size={16} />
							</span>
							<div class="model-info">
								<span class="model-name">{model.name}</span>
								{#if model.provider === 'local' && model.parameters}
									<span class="model-details">{model.parameters}</span>
								{/if}
								{#if model.provider === 'local' && model.size}
									<span class="model-size">{(model.size / 1024 / 1024 / 1024).toFixed(1)} GB</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			<!-- Handle empty states -->
			{:else if expandedModelList === 'local' && localServerStatus === 'offline'}
				<div class="no-models">
					<Icon name="Server" size={48} />
					<p>Local server is offline</p>
					<p class="text-sm">Make sure Ollama is running on localhost:11434</p>
					<button class="retry-button" on:click={loadLocalModels}>
						<Icon name="RefreshCw" size={16} />
						Retry Connection
					</button>
				</div>
			{:else if expandedModelList === 'local' && localServerStatus === 'online'}
				<div class="no-models">
					<Icon name="Download" size={48} />
					<p>No local models found</p>
					<p class="text-sm">Pull some models with: <code>ollama pull llama3.2</code></p>
				</div>
			{:else}
				<div class="no-models">
					<p>No models available for this provider</p>
				</div>
			{/if}
						</div>

		</div>
	</div>
{/if}
<div class="model-column">
	{#if favoritesInitialized}
		<div class="favorites-container">
			<h4>Favorite Models</h4>
			{#if favoriteModels.length > 0}
				<div class="favorites-list">
					{#each favoriteModels as model}
						<button
							class="model-button favorite-model"
							class:model-selected={selectedModel &&
								selectedModel.id === model.id &&
								selectedModel.provider === model.provider}
							on:click={() => handleModelSelection(model)}
						>
								<span class="provider-badge">{providers[model.provider]?.name}</span>
								<span class="model-name-wrapper">
								<span class="star-button star-active" on:click={(e) => toggleFavorite(model, e)}>
								<Icon name="Star" size={16} />
								</span>
							<span class="model-name">{model.name}</span>
								</span>


						</button>
					{/each}
				</div>
			{:else}
				<div class="no-favorites">
					<div class="small-spinner-container">
						<div class="small-spinner">
							<Icon name="Bot" />
						</div>
					</div>
					<p>Star your favorite models to see them here</p>
				</div>
			{/if}
		</div>
	{/if}

	<div class="selector-container">
<div class="providers-list">
	{#each Object.entries(enhancedProviders) as [key, provider]}
		<div class="provider-item">
			<button
				class="provider-button"
				class:provider-selected={currentProvider === key}
				on:click={() => handleProviderClick(key)}
			>
				<div class="provider-info">
					{#if key === 'local'}
						<div class="provider-icon-lucide">
							<Icon name="Bot" size={24} />
						</div>
					{:else}
						<img src={provider.icon} alt={provider.name} class="provider-icon" />
					{/if}
					<span class="provider-name" class:visible={currentProvider === key}>
						{provider.name}
					</span>
				</div>
				<div class="provider-status">
					{#if key === 'local'}
						{#if isLoadingLocalModels}
							<div class="icon-wrapper loading">
								<div class="spinner"></div>
							</div>
						{:else if localServerStatus === 'online' && availableProviderModels.local?.length > 0}
							<div class="icon-wrapper success">
								<Icon name="CheckCircle2" size={35} />
							</div>
						{:else if localServerStatus === 'online' && availableProviderModels.local?.length === 0}
							<div class="icon-wrapper warning">
								<Icon name="AlertCircle" size={35} />
							</div>
						{:else}
							<div class="icon-wrapper error">
								<Icon name="XCircle" size={35} />
							</div>
						{/if}
					{:else if get(apiKey)[key]}
						<div class="icon-wrapper success">
							<Icon name="CheckCircle2" size={35} />
						</div>
					{:else}
						<div class="icon-wrapper error">
							<Icon name="XCircle" size={35} />
						</div>
					{/if}
				</div>
			</button>
		</div>
	{/each}
</div>
	</div>
</div>

{#if isOffline}
	<div class="offline-indicator">
		<Icon name="XCircle" size={16} color="orange" />
		<span>Offline</span>
	</div>
{/if}

{#if isOffline}
	<div class="offline-indicator">
		<Icon name="XCircle" size={16} color="orange" />
		<span>Offline</span>
	</div>
{/if}


</div>
<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.model-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	// .model-wrap {
	// 	display: flex;
	// 	flex-wrap: wrap;
	// 	width: 100%;
	// }
	.model-column {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: flex-end;
		width: 100%;
		border-radius: 1rem;
	}
	.selector-container {
		display: flex;
		position: relative;
		flex-wrap: wrap;

		z-index: 1;
		width: 100%;
		margin-left: 0;
		margin-right: 0;
		margin-bottom: 0;
		justify-content: center;
		align-items: center;
		overflow-x: auto;
	}

	.providers-list {
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		width: 100%;
		height: calc(100% - 2rem);
		position: relative;
		margin-top: 1rem;
		margin-right: 2rem;
	}

	button {
		width: auto;
		border: 2px solid var(--primary-color) !important;
	}

	.provider-item {
		width: auto;
		height: auto;
		position: relative;
		background: var(--primary-color);
		border-radius: var(--radius-xl);
		&.active {
			background: var(--primary-color);
		}
	}

	.provider-button {
		width: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		padding: 1rem;
		background: var(--bg-color);
		border-radius: var(--radius-xl);
		border: 1px solid transparent;
		color: var(--text-color);
		transition: all 0.2s ease;
		z-index: 3000;

		&:hover {
			background: var(--primary-color);
			cursor: pointer;

			.provider-name {
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 1rem;
				font-weight: 700;
			}
		}

		&.provider-selected {
			background-color: var(--primary-color);
			color: white;
			justify-content: center;



			box-shadow: var(--tertiary-color) 0 0 10px 1px;
			.provider-name {
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 0;
			}
		}
	}

	.provider-info {
		display: flex;
		align-items: center;
		justify-content: left;
		gap: 0.5rem;
		
	}

	.provider-icon,
	.provider-icon-lucide {
		display: flex;
		align-items: center;
		justify-content: center;

		width: 2rem;
		height: 2rem;
		padding: 0;
	}

	.provider-name {
		font-size: 1.2rem;
		opacity: 0;
		width: 0;
		max-width: 0;
		overflow: hidden;
		white-space: nowrap;
		transition: all 0.3s ease;
		user-select: none;
		letter-spacing: 0;

		&.visible {
			opacity: 1;
			width: auto;
			max-width: 200px;
			margin-left: 1rem;
		}
	}

	.model-overlay {
		position: relative;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		// background: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 9999;

	}

	.model-list-container {
		background: var(--bg-color);
		border-radius: 1rem;
		border: 2px solid var(--primary-color);
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-wrap: wrap;
		flex-direction: column;


	}

	.model-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		border-bottom: 1px solid var(--primary-color);
		& .header-actions {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: center;
			gap: 1rem;
			& .header-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0;
				margin: 0;
				height: 2rem;
				background: transparent;
				border: none !important; 
				cursor: pointer;

			}
		}
		
		h3 {
			margin: 0;
			font-size: 1.2rem;
			color: var(--text-color);
		}

		.close-btn {
			width: 4rem;
			height: 4rem;
			&:hover {
				background: var(--primary-color);
				transform: none;
			}
		}
	}

	.model-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		align-items: flex-end;
		align-items: left;
		gap: var(--spacing-sm);
		max-height: 60vh;
		overflow-y: auto;
		padding: 1rem 2rem;
	}

	.model-button {
		display: flex;

		padding: 1rem;
		background: var(--primary-color);
		border: none !important;
		border-radius: var(--radius-xl);
		color: var(--placeholder-color);
		font-size: 1.25rem;
		transition: all 0.2s ease;
		z-index: 1;
		opacity: 0.5;
		font-weight: 200;
		width: auto;

		text-align: left;
		text-justify: left;
		& span.star-icon {
			width: 2rem;
			height: 2rem;
			display: flex;
			justify-content: center;
			align-items: center;
			&:hover {
				transform: scale(1.5);
			}
		}

		&:hover {
			background: var(--primary-color);
			color: white;
			// transform: translateX(1rem);
			opacity: 1;
			cursor: pointer;
		}

		&.model-selected {
			background: var(--primary-color);
			color: white;
			opacity: 1;
		}
	}

	.offline-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background-color: rgba(255, 165, 0, 0.1);
		border-radius: 4px;
		font-size: 0.75rem;
		color: orange;
	}

	.provider-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: absolute;
		right: -0.5rem;
		top: 0;

		.icon-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 1.7rem;
			width: 1.7rem;
			&.success :global(svg) {
				color: rgb(0, 200, 0);
				stroke: var(--bg-color);
				background-color: rgb(0, 200, 0);
				border-radius: 50%;
				fill: none;
				height: 1.7rem;
				width: 1.7rem;
			}

			&.error :global(svg) {
				color: rgb(255, 0, 0);
				stroke: var(--bg-color);
				border-radius: 50%;
				background-color: rgb(255, 0, 0);

				fill: none;
				height: 1.7rem;
				width: 1.7rem;
			}
		}
	}

	.no-models {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2rem;
		color: var(--placeholder-color);
	}

	.api-key-container {
		display: flex;
		justify-content: center;
		flex-direction: column;
		align-items: center;
		width: 100%;
	}
	input {
		width: 100%;
		padding: 1.5rem;
		padding-right: 3rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		font-size: 1rem;
		background: transparent;
		color: var(--text-color);

		/* Make the password reveal icon white */
		&::-ms-reveal {
			filter: invert(100%) brightness(200%) contrast(100%);
			margin-right: 2rem; /* Move the icon left */
			position: relative;
			right: 2rem;
		}

		&::-webkit-credentials-auto-fill-button {
			filter: invert(100%) brightness(200%) contrast(100%);
			margin-right: 2rem; /* Move the icon left */
			position: relative;
			right: 2rem;
		}
	}

	/* Global styles for password reveal icon across browsers */
	:global(input[type='password']::-ms-reveal),
	:global(input[type='password']::-webkit-credentials-auto-fill-button) {
		filter: invert(100%) brightness(200%) contrast(100%);
		margin-right: 12px;
	}

	input::placeholder {
		font-size: 1.2rem;
		color: var(--placeholder-color);
		width: 90%;
		font-style: italic;
	}

	input:focus {
		outline: none;
		border-color: var(--primary-color);
		box-shadow: 0 0 0 2px var(--primary-color-transparent);
		z-index: 1000;
		color: var(--text-color);
	}

	form {
		border: 1px solid var(--border-color);
		width: 100%;
		background: var(--bg-color);
	}
	button {
		display: flex;
		align-items: center;

		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		width: 100%;
		height: 60px;
		background: var(--bg-gradient);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;
		font-size: 1.2rem;

		&:hover {
			transform: translateY(-4px);
			background: var(--bg-gradient-r);
		}

		span {
			font-size: 0.9rem;
		}
	}

	.favorites-container {
		// border: 1px solid var(--line-color);
		border-radius: 1rem;
		// background: var(--primary-color);
		padding: 0.5rem;
		overflow-y: auto;
		height: auto;
		width: calc(100% - 1rem);

		& h4 {
			margin-bottom: 0.5rem;
			text-align: left;
			padding-inline-start: 2rem;
			font-size: 1.2rem;
		}
	}

	.favorites-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 2rem;
	}

	.favorite-model {
		display: flex;
		align-items: center;
		position: relative;
		padding: 0 0.5rem;
		width: auto !important;
		border-radius: 1rem;
		background-color: var(--secondary-color);
	}

	.provider-badge {
		font-size: 0.7rem;
		background-color: rgba(0, 0, 0, 0.1);
		padding: 0.25rem;
		border-radius: 1rem 1rem 0 0;
		position: absolute;
		justify-content: flex-end;
		display: flex;
		right: 0;
		left: 0;
		top: 0;
		color: var(--tertiary-color);
	}

	.model-name-wrapper {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 1rem;

	}
	.star-button {
		border: none;
		cursor: pointer;
		display: flex;
		padding: 0;
		border-radius: 0;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		opacity: 0.25;
		transition: opacity 0.2s ease;
	}
	.star-button:hover {
		opacity: 1;
	}

	.model-button:hover {
		opacity: 1;
	}

	.star-active {
		opacity: 1;
		background: transparent;
		width: auto;
		height: auto;
	}

	.model-info {
		display: flex;
		align-items: center;
	}

	.model-name {
		flex-grow: 1;
		text-align: left;
		font-size: 0.8rem;
		// padding-right: 1rem;
	}

	/* Additional style to ensure password reveal icon is properly positioned */
	:global(input[type='password']::-ms-reveal) {
		filter: invert(1);
		margin-right: 8px;
	}

	:global(input[type='password']::-webkit-credentials-auto-fill-button) {
		filter: invert(1);
		margin-right: 8px;
	}

	@media (max-width: 768px) {
		.model-column {
			// flex-direction: row;
		}
		// .selector-container {
		// 	height: auto;
		// 	width: 100%;
		// 	height: 100%;
		// 	margin-bottom: 0;
		// 	box-shadow: none !important;
		// }
		.selector-container {
			justify-content: center;
			width: 100%;
		}
			.provider-info {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		// padding: 0 0.15rem;
		
	}

	.providers-list {
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		width: 100%;
		height: calc(100% - 2rem);
		position: relative;
		margin-top: 1rem;
		margin-right: 2rem;
	}

	.provider-icon {
		width: 1.3rem;
		height: 1.3rem;
		padding: 0 0.25rem;
	}

	.provider-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0;
		background: var(--secondary-color);
		border: 1px solid transparent;
		color: var(--text-color);
		transition: all 0.2s ease;
		z-index: 3000;
		height: 2rem;
		width: 2rem;

		&:hover {
			background: var(--bg-color);
			cursor: pointer;
			transform: translateX(0);
			width: auto;
				padding: 0 0.5rem;
		justify-content: center;
 
			.provider-name {
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 0;
				font-weight: 700;
				font-size: 0.8rem;
			}
		}

		&.provider-selected {
			transition: all 0.2s ease;
			&:hover {
				.provider-name {
					display: flex;
				}
			}
			.provider-name {
				display: none;
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 0;
				font-size: 0.8rem;
				transition: all 0.2s ease;
			}
		}
	}
		.offline-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background-color: rgba(255, 165, 0, 0.1);
		border-radius: 4px;
		font-size: 0.75rem;
		color: orange;
	}

	.provider-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: absolute;
		right: -0.5rem;
		top: -0.25rem;

		.icon-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 1rem;
			width: 1rem;
			&.success :global(svg) {
				color: rgb(0, 200, 0);
				stroke: var(--bg-color);
				background-color: rgb(0, 200, 0);
				border-radius: 50%;
				fill: none;
				height: 1rem;
				width: 1rem;
			}

			&.error :global(svg) {
				color: rgb(255, 0, 0);
				stroke: var(--bg-color);
				border-radius: 50%;
				background-color: rgb(255, 0, 0);

				fill: none;
				height: 1rem;
				width: 1rem;
			}
		}
	}


	.provider-item {
		width: auto;
		height: auto;
		position: relative;
		justify-content: center !important;
		align-items: center;
		margin: 0;
		background: var(--primary-color);
		border-radius: var(--radius-xl);
		&.active {
			background: var(--primary-color);
		}
	}

		.model-name {
		text-align: left;
		font-size: 0.8rem;
		// padding-right: 1rem;
	}
	.favorites-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.favorite-model {
		display: flex;
		align-items: center;
		position: relative;
		padding: 0 0.5rem;
		width: auto !important;
		border-radius: 1rem;
		background-color: var(--secondary-color);
	}


	.model-button {
		padding: 0.5rem;
		height: auto;
	}

	.star-button {
		padding: 0;
		
	}

	.favorites-container {
		// border: 1px solid var(--line-color);
		border-radius: 1rem;
		// background: var(--primary-color);
		padding: 0.5rem;
		overflow-y: auto;
		height: auto;
		width: calc(100% - 1rem);

		& h4 {
			margin-bottom: 0;
			text-align: left;
			padding-inline-start: 1rem;
			font-size: 1.2rem;
		}
	}

	}

	@media (max-width: 450px) {



		.provider-item {
			height: auto;
		}


		// .provider-button {
		// 	width: auto;
		// 	display: flex;
		// 	align-items: center;
		// 	justify-content: space-between;
		// 	gap: var(--spacing-sm);
		// 	padding: 0.5rem;
		// 	background: var(--bg-color);
		// 	border-radius: var(--radius-xl);
		// 	border: 1px solid transparent;
		// 	color: var(--text-color);
		// 	transition: all 0.2s ease;
		// 	letter-spacing: 0.4rem;
		// 	z-index: 3000;

		// 	&:hover {
		// 		background: var(--primary-color);
		// 		cursor: pointer;
		// 		transform: translateX(0);

		// 		.provider-name {
		// 			opacity: 1;
		// 			width: auto;
		// 			max-width: 200px;
		// 			margin-left: 1rem;
		// 			font-weight: 700;
		// 			letter-spacing: 0.5rem;
		// 			display: none;
		// 		}
		// 	}

		// 	&.provider-selected {
		// 		background-color: var(--primary-color);
		// 		color: white;
		// 		height: 100%;

		// 		.provider-name {
		// 			opacity: 1;
		// 			width: auto;
		// 			display: none;
		// 		}
		// 	}
		// }
	}
</style>
