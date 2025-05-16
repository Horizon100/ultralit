<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { AIModel } from '$lib/types/types';
	import { Bot, Settings, Key, CheckCircle2, XCircle, Star, Trash2 } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { defaultModel } from '$lib/constants/models';
	import APIKeyInput from '$lib/components/common/keys/APIKeyInput.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { get } from 'svelte/store';
	import { providers, type ProviderType } from '$lib/constants/providers';
	import { modelStore } from '$lib/stores/modelStore';
	import { currentUser } from '$lib/pocketbase';

	export let provider: string;

	export let expandedModelList: ProviderType | null = null;

	export let selectedModel: AIModel = defaultModel;
	let isInitialized = false;
	let isLoadingPreferences = true;
    let isLoadingModels = false;
	let key = '';
	let favoriteModels: AIModel[] = [];
	let userModelPreferences: string[] = [];
	let favoritesInitialized = false;
	let currentProvider: ProviderType | null = null;
	let showAPIKeyInput = false;
	let isOffline = false;
	let availableProviderModels: Record<ProviderType, AIModel[]> = {
		openai: [],
		anthropic: [],
		google: [],
		grok: [],
		deepseek: []
	};

	const dispatch = createEventDispatcher<{
		submit: string;
		close: void;
		select: AIModel;
		toggleFavorite: { modelId: string; isFavorite: boolean };
	}>();
	modelStore.subscribe((state) => {
		isOffline = state.isOffline;
	});

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
    
    try {
        console.log(`Deleting API key for ${provider}`);
        
        const confirmed = confirm(`Are you sure you want to delete your ${providers[provider].name} API key?`);
        if (!confirmed) return;
        
        await apiKey.deleteKey(provider);
        
        availableProviderModels[provider] = [];
        
        if (expandedModelList === provider) {
            expandedModelList = null;
            currentProvider = null;
            showAPIKeyInput = false;
        }
        
        updateFavoriteModels();
        
        console.log(`Successfully deleted API key for ${provider}`);
    } catch (error) {
        console.error(`Error deleting API key for ${provider}:`, error);
        alert(`Failed to delete API key: ${error.message}`);
    }
}
	async function handleProviderClick(key: string) {
        const provider = key as ProviderType;
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
        } else {
            if ($currentUser) {
                try {
                    isLoadingModels = true;
                    await modelStore.setSelectedProvider($currentUser.id, provider);
                    await loadProviderModels(provider);
                    showAPIKeyInput = false;
                } catch (error) {
                    console.warn('Error setting provider:', error);
                } finally {
                    isLoadingModels = false;
                }
            }
        }
    }


async function handleModelSelection(model: AIModel) {
    const enrichedModel: AIModel = {
        ...model,
        provider: model.provider
    };
    
    console.log('Selected model with provider:', enrichedModel.provider);
    
    if ($currentUser) {
        try {
            const success = await modelStore.setSelectedModel($currentUser.id, enrichedModel);
            if (success) {
                selectedModel = enrichedModel;
                console.log('Saved model selection to model store');
                
                currentProvider = model.provider as ProviderType;
            }
        } catch (error) {
            console.warn('Error selecting model:', error);
        }
    } else {
        selectedModel = enrichedModel;
        currentProvider = model.provider as ProviderType;
    }
    
    expandedModelList = null;
    
    // Dispatch the selection event
    dispatch('select', enrichedModel);
}

	async function loadProviderModels(provider: ProviderType) {
        isLoadingModels = true;
        try {
            const currentKey = get(apiKey)[provider];
            console.log(`Loading models for ${provider}, has key: ${Boolean(currentKey)}`);
            
            if (currentKey) {
                const providerModelList = await providers[provider].fetchModels(currentKey);
                availableProviderModels[provider] = providerModelList.map(model => ({
                    ...model,
                    provider
                })) || [];
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
			models.forEach(model => {
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
		
		console.log('Updated favorite models:', favoriteModels.map(m => `${m.provider}:${m.name}`));
	}
	async function toggleFavorite(model: AIModel, event: MouseEvent) {
    event.stopPropagation(); 
    
    if (!$currentUser) return;
    
    const modelId = model.id;
    const modelKey = `${model.provider}-${modelId}`;
    const isFavorite = userModelPreferences.includes(modelKey);
    
    // Update local state first for responsive UI
    if (isFavorite) {
        userModelPreferences = userModelPreferences.filter(id => id !== modelKey);
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
                userModelPreferences = userModelPreferences.filter(id => id !== modelKey);
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
            userModelPreferences = userModelPreferences.filter(id => id !== modelKey);
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

	onMount(async () => {
    if ($currentUser) {
        console.log("Loading API keys and preferences on component mount...");
        
        // Load preferences first
        await loadUserModelPreferences();
        
        // Then load API keys
        await apiKey.loadKeys();
        
        // Load available models for providers with keys
        const availableKeys = get(apiKey);
        
        // Find available providers with keys
        const availableProviders = Object.entries(availableKeys)
            .filter(([_, key]) => !!key)
            .map(([provider]) => provider);
        
        if (availableProviders.length > 0) {
            // Load all provider models to populate favorites
            await Promise.all(
                availableProviders.map(async (providerKey) => {
                    try {
                        await loadProviderModels(providerKey as ProviderType);
                    } catch (error) {
                        console.error(`Error loading models for ${providerKey}:`, error);
                    }
                })
            );
            
            // After loading all models, update favorites list
            updateFavoriteModels();
        }
        
        // Find and set the initial provider
        let initialProvider = selectedModel?.provider || provider || 'deepseek';
        if (!availableKeys[initialProvider] && availableProviders.length > 0) {
            initialProvider = availableProviders[0];
        }
        
        currentProvider = initialProvider as ProviderType;
        
        // Mark as fully initialized after everything is loaded
        isInitialized = true;
    } else {
        // Even without a user, mark as initialized
        favoritesInitialized = true;
        isInitialized = true;
    }
});
</script>
<div class="model-column">
	{#if favoritesInitialized}

	<div class="favorites-container">
		<h4>Favorite Models</h4>
		{#if favoriteModels.length > 0}
		<div class="favorites-list">
			{#each favoriteModels as model}
				<button
					class="model-button favorite-model"
					class:model-selected={selectedModel && selectedModel.id === model.id && selectedModel.provider === model.provider}
					on:click={() => handleModelSelection(model)}
				>
					<span class="model-name">{model.name}</span>
					<span class="provider-badge">{providers[model.provider]?.name}</span>
					<button 
						class="star-button star-active" 
						on:click={(e) => toggleFavorite(model, e)}
					>
						<Star size={16} fill="#FFD700" />
					</button>
				</button>
			{/each}
		</div>
		{:else}
			<div class="no-favorites">
				<div class="small-spinner-container">
					<div class="small-spinner">
						<Bot />
					</div>

				</div>
				<p>Star your favorite models to see them here</p>

			</div>
		{/if}
	</div>
	{/if}

	<div class="selector-container">
		<div class="providers-list">
			{#each Object.entries(providers) as [key, provider]}
				<div class="provider-item">
					<button
						class="provider-button"
						class:provider-selected={currentProvider === key}
						on:click={() => handleProviderClick(key)}
					>
						<div class="provider-info">
							<img src={provider.icon} alt={provider.name} class="provider-icon" />
							<span class="provider-name" class:visible={currentProvider === key}>
								{provider.name}
							</span>
						</div>
						<div class="provider-status">
							{#if get(apiKey)[key]}
								<div class="icon-wrapper success">
									<CheckCircle2 />
								</div>
							{:else}
								<div class="icon-wrapper error">
									<XCircle size={35} />
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
		<XCircle size={16} color="orange" />
		<span>Offline</span>
	</div>
{/if}

{#if expandedModelList}
    <div class="model-overlay"
	on:click={handleClickOutside}
	transition:fly={{ y: -20, duration: 200 }}
	>
        <div class="model-list-container">
            <div class="model-header">
                <h3>{providers[expandedModelList].name} Models {isLoadingModels ? '' : `(${availableProviderModels[expandedModelList]?.length || 0})`}</h3>
   
				<div class="header-actions">
					{#if get(apiKey)[expandedModelList]}
						<button 
							class="delete-key-button"
							on:click|stopPropagation={() => handleDeleteAPIKey(expandedModelList)}
							title="Delete {providers[expandedModelList].name} API key"
						>
							<Trash2 size={20}  />
						</button>
					{/if}
					
					<!-- Close button -->
					<button class="close-btn" on:click={() => (expandedModelList = null)}>
						<XCircle size={35} />
					</button>
				</div>
            </div>

            {#if isLoadingModels}
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <p>Loading models...</p>
                </div>
            {:else if showAPIKeyInput}
                <div class="api-key-container">
                    <h4>Enter {providers[expandedModelList].name} API Key</h4>
						<APIKeyInput provider={expandedModelList} on:submit={handleAPIKeySubmit} />
                </div>
            {:else if availableProviderModels[expandedModelList]?.length > 0}
                <div class="model-list">
					
                    {#each availableProviderModels[expandedModelList] as model}
                        <button
                            class="model-button"
                            class:model-selected={selectedModel.id === model.id}
                            on:click={() => handleModelSelection(model)}
                        >
						<span 
							class="star-button" 
							class:star-active={userModelPreferences.includes(`${model.provider}-${model.id}`)}
							on:click={(e) => toggleFavorite(model, e)}
						>
							<Star 
								size={30} 
							/>

						</span>
                            {model.name}
                        </button>
                    {/each}
                </div>
            {:else}
                <div class="no-models">
					<p>No models available for this provider</p>
                </div>
				<!-- <form
					on:submit={handleSubmit}
					transition:fly={{ y: 20, duration: 200 }}
				>
					<div class="input-wrapper">
						<input
							type="password"
							bind:value={key}
							class="w-full px-4 py-2 rounded-lg bg-secondary"
							placeholder="Enter your API key"
							autofocus
						/>
					</div>
					<button type="submit" class="submit-button"> Save Key </button>
				</form> -->
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
	@use 'src/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);
	}
	.model-column {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: flex-end;
		gap: 0.5rem;
		width: 100%;
	}
	.selector-container {
		display: flex;
		position: relative;
		flex-wrap: wrap;
		border-top-left-radius: var(--radius-xl);
		border-top-right-radius: var(--radius-xl);
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
		letter-spacing: 0.4rem;
		z-index: 3000;

		&:hover {
			background: var(--primary-color);
			cursor: pointer;
			transform: translateX(1rem);

			.provider-name {
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 1rem;
				font-weight: 700;
				letter-spacing: 0.5rem;

			}
		}

		&.provider-selected {
			background-color: var(--primary-color);
			color: white;
			width: 100% !important;
			height: 100%;
            
            .provider-name {
                opacity: 1;
                width: auto;
                max-width: 200px;
                margin-left: 1rem;
            }
		}
	}

	.provider-info {
		display: flex;
		align-items: center;
		justify-content: left;
		gap: var(--spacing-sm);
	}

	.provider-icon {
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
		
		&.visible {
			opacity: 1;
			width: auto;
			max-width: 200px;
			margin-left: 1rem;
		}
	}

	.model-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 9999;
		backdrop-filter: blur(3px);
	}

	.model-list-container {
		background: var(--bg-color);
		border-radius: var(--radius-xl);
		border: 2px solid var(--primary-color);
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
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
		}
		h3 {
			margin: 0;
			font-size: 1.5rem;
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
		flex-direction: column;
		align-items: left;
		gap: var(--spacing-sm);
		max-height: 60vh;
		overflow-y: auto;
		padding: 1rem 2rem;
	}

	.model-button {
		padding: 1rem;
		background: var(--bg-gradient-left);
		border: none !important;
		border-radius: var(--radius-xl);
		color: var(--placeholder-color);
		font-size: 1.25rem;
		transition: all 0.2s ease;
		z-index: 1;
		opacity: 0.5;
		font-weight: 200;
		width: 100% !important;
		letter-spacing: 0.2rem;
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
				background-color:rgb(0, 200, 0);
				border-radius: 50%;
				fill: none;
				height: 1.7rem;
				width: 1.7rem;
			}

			&.error :global(svg) {
				color: rgb(255, 0, 0);
				stroke: var(--bg-color);
				border-radius: 50%;
				background-color:rgb(255, 0, 0);

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
		& h4 {
			margin-bottom: 0.5rem;
			text-align: left;
		}
    }
    
    .favorites-list {
        display: flex;
        flex-wrap: wrap;
		justify-content: flex-end;
        gap: 0.5rem;
    }
    
    .favorite-model {
        display: flex;
        align-items: center;
        position: relative;
		padding: 0 0.5rem;
		width: 200px !important;
		border-radius: 1rem;
    }
    
    .provider-badge {
        font-size: 0.7rem;
        background-color: rgba(0, 0, 0, 0.2);
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 6px;
		position: absolute;
		right: 0;
		top: 0;
    }
    
    .star-button {
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
		width: 3rem;
		height: 3rem;
        right: 8px;
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
    }
    
    .model-name {
        flex-grow: 1;
        text-align: left;
		font-size: 0.8rem;
        padding-right: 1rem;
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
			flex-direction: row;
		}
		.selector-container {
			height: auto;
			width: 100%;
			height: 100%;
			margin-bottom: 0;
			box-shadow: none !important;
		}

		.providers-list {
			display: flex;
			flex-direction: column;
			position: relative;
			height: 100;
			width: 100%;
			gap: var(--spacing-sm);
		}

		.provider-item {
			height: auto;
		}
	}

	@media (max-width: 450px) {
		.model-column {
			
			display: flex;
			margin-left: 2rem;
			margin-right: -2rem;
		}
		.selector-container {
			height: 100%;
			border-radius: 0;
			width: auto;
			margin: 0;
			justify-content: flex-end;
			align-items: flex-end;
		}

		.favorites-container {
			
		}

		.providers-list {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			align-items: flex-start;
			height: auto;
			margin: auto;
			width: 8rem;
			margin: 0;
			padding: 0;
			backdrop-filter: blur(10px);
			border-radius: 0;
			overflow-x: none;
			gap: var(--spacing-sm);
		}

		.provider-item {
			height: auto;
		}

		.model-list-container {
			width: 95%;
			max-height: 80vh;
		}
		.provider-button {
		width: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		padding: 0.5rem;
		background: var(--bg-color);
		border-radius: var(--radius-xl);
		border: 1px solid transparent;
		color: var(--text-color);
		transition: all 0.2s ease;
		letter-spacing: 0.4rem;
		z-index: 3000;

		&:hover {
			background: var(--primary-color);
			cursor: pointer;
			transform: translateX(0);

			.provider-name {
				opacity: 1;
				width: auto;
				max-width: 200px;
				margin-left: 1rem;
				font-weight: 700;
				letter-spacing: 0.5rem;
				display: none;

			}
		}
		

		&.provider-selected {
			background-color: var(--primary-color);
			color: white;
			height: 100%;
            
            .provider-name {
                opacity: 1;
                width: auto;
				display: none;
            }
		}
	}
	}
</style>