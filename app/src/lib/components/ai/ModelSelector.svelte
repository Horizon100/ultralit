<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { AIModel } from '$lib/types/types';
	import { Bot, Settings, Key, CheckCircle2, XCircle } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { defaultModel } from '$lib/constants/models';
	import APIKeyInput from '$lib/components/common/keys/APIKeyInput.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { get } from 'svelte/store';
	import { providers, type ProviderType } from '$lib/constants/providers';
	import { modelStore } from '$lib/stores/modelStore';
	import { currentUser } from '$lib/pocketbase';

	export let provider: string = 'deepseek'; // Default to deepseek if not provided

	const dispatch = createEventDispatcher<{
		submit: string;
		close: void;
		select: AIModel;
	}>();

	let key = '';

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
	let isOffline = false;

	let expandedModelList: ProviderType | null = null;
    let isLoadingModels = false;

	modelStore.subscribe((state) => {
		isOffline = state.isOffline;
	});

	export let selectedModel: AIModel = defaultModel;

	let currentProvider: ProviderType | null = null;
	let showAPIKeyInput = false;
	let availableProviderModels: Record<ProviderType, AIModel[]> = {
		openai: [],
		anthropic: [],
		google: [],
		grok: [],
		deepseek: []
	};



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
		// Ensure model has provider information
		const enrichedModel: AIModel = {
			...model,
			provider: currentProvider || model.provider || 'deepseek' // Default to deepseek if no provider
		};
		
		console.log('Selected model with provider:', enrichedModel.provider);
		
		if ($currentUser) {
			try {
				const success = await modelStore.setSelectedModel($currentUser.id, enrichedModel);
				if (success) {
					selectedModel = enrichedModel;
					console.log('Saved model selection to model store');
				}
			} catch (error) {
				console.warn('Error selecting model:', error);
			}
		}
		expandedModelList = null;
		currentProvider = null; 
		dispatch('select', enrichedModel);
	}

	async function loadProviderModels(provider: ProviderType) {
        isLoadingModels = true;
        try {
            const currentKey = get(apiKey)[provider];
            console.log(`Loading models for ${provider}, has key: ${Boolean(currentKey)}`);
            
            if (currentKey) {
                const providerModelList = await providers[provider].fetchModels(currentKey);
                // Ensure provider information is set for each model
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

	onMount(async () => {
    // Make an explicit call to load API keys
    if ($currentUser) {
        console.log("Loading API keys on component mount...");
        await apiKey.loadKeys();
        
        // Log available keys to help debug
        const availableKeys = get(apiKey);
        console.log("Available API keys for providers:", Object.keys(availableKeys));
        
        // Find available providers with keys
        const availableProviders = Object.entries(availableKeys)
            .filter(([_, key]) => !!key)
            .map(([provider]) => provider);
        
        if (availableProviders.length === 0) {
            console.warn("No API keys found for any provider");
            return;
        }
        
        // Set initial provider based on existing keys, selected model, or default
        // If the selected model's provider has a key, use that provider
        let initialProvider = selectedModel?.provider || provider || 'deepseek';
        
        // If the initial provider doesn't have a key, use the first available provider
        if (!availableKeys[initialProvider] && availableProviders.length > 0) {
            initialProvider = availableProviders[0];
            console.log(`Selected provider has no key, falling back to: ${initialProvider}`);
        }
        
        currentProvider = initialProvider as ProviderType;
        
        // If we have a key for this provider, try to load its models
        if (availableKeys[initialProvider]) {
            console.log(`Found key for ${initialProvider}, loading models...`);
            try {
                isLoadingModels = true;
                await modelStore.setSelectedProvider($currentUser.id, initialProvider as ProviderType);
                await loadProviderModels(initialProvider as ProviderType);
                
                // If no model is selected yet, select the first model from this provider
                if (!selectedModel?.id && availableProviderModels[initialProvider as ProviderType]?.length > 0) {
                    const firstModel = availableProviderModels[initialProvider as ProviderType][0];
                    console.log("Auto-selecting first available model:", firstModel.name);
                    await handleModelSelection(firstModel);
                }
            } catch (error) {
                console.error(`Error loading models for ${initialProvider}:`, error);
            } finally {
                isLoadingModels = false;
            }
        } else {
            console.log(`No API key found for ${initialProvider}`);
        }
    }
});
</script>

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
                <button class="close-btn" on:click={() => (expandedModelList = null)}>
					<XCircle size={35} />
                </button>
            </div>
            
            {#if isLoadingModels}
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <p>Loading models...</p>
                </div>
            {:else if showAPIKeyInput}
                <div class="api-key-container">
                    <h4>Enter {providers[expandedModelList].name} API Key</h4>
                    <APIKeyInput on:submit={handleAPIKeySubmit} />
                </div>
            {:else if availableProviderModels[expandedModelList]?.length > 0}
                <div class="model-list">
                    {#each availableProviderModels[expandedModelList] as model}
                        <button
                            class="model-button"
                            class:model-selected={selectedModel.id === model.id}
                            on:click={() => handleModelSelection(model)}
                        >
                            {model.name}
                        </button>
                    {/each}
                </div>
            {:else}
                <div class="no-models">
                    <p>No models available for this provider</p>
                </div>
				<form
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
				</form>
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
	@use 'src/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);
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
		padding: 2rem;
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
		
		&:hover {
			background: var(--primary-color);
			color: white;
			transform: translateX(1rem);
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

	.spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
    
    p {
        color: var(--text-color);
        margin: 0;
    }
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    border-top-color: var(--tertiary-color);
    animation: spin 1s ease-in-out infinite;
}

.no-models {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    color: var(--placeholder-color);
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

	/* Additional style to ensure password reveal icon is properly positioned */
	:global(input[type='password']::-ms-reveal) {
		filter: invert(1);
		margin-right: 8px;
	}

	:global(input[type='password']::-webkit-credentials-auto-fill-button) {
		filter: invert(1);
		margin-right: 8px;
	}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}



	@media (max-width: 768px) {
		.selector-container {
			height: auto;
			width: 100%;
			height: 100%;
			margin-bottom: 4rem;
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
		.selector-container {
			height: 100%;
		}

		.providers-list {
			display: flex;
			flex-direction: row;
			height: auto;
			overflow-x: scroll;
			gap: var(--spacing-sm);
		}

		.provider-item {
			height: auto;
		}

		.model-list-container {
			width: 95%;
			max-height: 80vh;
		}
	}
</style>