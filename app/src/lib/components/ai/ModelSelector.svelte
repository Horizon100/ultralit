<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { AIModel } from '$lib/types';
  import { Bot, Settings, Key, CheckCircle2, XCircle } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  import { defaultModel } from '$lib/constants/models';
  import APIKeyInput from '$lib/components/common/keys/APIKeyInput.svelte';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { get } from 'svelte/store';
  import { providers, type ProviderType } from '$lib/constants/providers';
  import { modelStore } from '$lib/stores/modelStore';
  import { currentUser } from '$lib/pocketbase';

  let isOffline = false;

  let expandedModelList: ProviderType | null = null;
  
  modelStore.subscribe(state => {
    isOffline = state.isOffline;
  });
  
  export let selectedModel: AIModel = defaultModel;

  const dispatch = createEventDispatcher<{
    select: AIModel;
  }>();

  let currentProvider: ProviderType | null = null;
  let showAPIKeyInput = false;
  let availableProviderModels: Record<ProviderType, AIModel[]> = {
    openai: [],
    anthropic: [],
    google: [],
    grok: []
  };

  async function handleProviderClick(key: string) {
  const provider = key as ProviderType;
  const currentKey = get(apiKey)[provider];
  
  if (currentProvider === provider) {
    currentProvider = null;
    expandedModelList = null; // Reset the expanded list
    return;
  }
  
  currentProvider = provider;
  expandedModelList = provider;  // Set which provider's list is expanded

  if (!currentKey) {
    showAPIKeyInput = true;
  } else {
    if ($currentUser) {
      try {
        await modelStore.setSelectedProvider($currentUser.id, provider);
        await loadProviderModels(provider);
        showAPIKeyInput = false;
      } catch (error) {
        console.warn('Error setting provider:', error);
      }
    }
  }
}

async function handleModelSelection(model: AIModel) {
  if ($currentUser) {
    try {
      const success = await modelStore.setSelectedModel($currentUser.id, model);
      if (success) {
        selectedModel = model;
      }
    } catch (error) {
      console.warn('Error selecting model:', error);
    }
  }
  expandedModelList = null; // Close the model list
  currentProvider = null;  // Close the provider selection
  dispatch('select', model);
}

  async function loadProviderModels(provider: ProviderType) {
    const currentKey = get(apiKey)[provider];
    if (currentKey) {
      try {
        const providerModelList = await providers[provider].fetchModels(currentKey);
        availableProviderModels[provider] = providerModelList;
      } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);
      }
    }
  }

  async function handleAPIKeySubmit(event: CustomEvent<string>) {
    if (currentProvider) {
      await apiKey.setKey(currentProvider, event.detail);
      showAPIKeyInput = false;
      await loadProviderModels(currentProvider);
    }
  }
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
            <span class="provider-name">{provider.name}</span>
          </div>
          <div class="provider-status">
            {#if $apiKey[key]}
              <div class="icon-wrapper success">
                <CheckCircle2 size={16} />
              </div>
            {:else}
              <div class="icon-wrapper error">
                <XCircle size={16} />
              </div>
            {/if}
          </div>
        </button>
        
        {#if currentProvider === key}
        {#if showAPIKeyInput}
          <div class="api-key-wrapper" in:fly={{ y: 10, duration: 200 }} out:fly={{ y: -10, duration: 200 }}>
            <APIKeyInput
              provider={currentProvider}
              on:submit={handleAPIKeySubmit}
              on:close={() => showAPIKeyInput = false}
            />
          </div>
        {/if}
      
        {#if availableProviderModels[key].length > 0 && expandedModelList === key}
          <div class="model-list" in:fly={{ y: 10, duration: 200 }} out:fly={{ y: -10, duration: 200 }}>
            {#each availableProviderModels[key] as model}
              <button 
                class="model-button"
                class:model-selected={selectedModel.id === model.id}
                on:click={() => handleModelSelection(model)}
              >
                {model.name}
              </button>
            {/each}
          </div>
        {/if}
      {/if}
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

<style lang="scss">
  @use "src/themes.scss" as *;

  * {
    font-family: var(--font-family);
    
  }

  .selector-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    width: auto;
    margin-bottom: 3rem;
    margin-right: 1rem;
    border-radius: var(--radius-m);
    box-shadow: 2px 4px 20px 1px rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(100px);
    transition: all 0,3s ease-in;
    padding: 1rem;
  }

  

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    height: 100%;
    position: relative;

  }

  button {
    // width: 150px !important;
  }

  .provider-item {
    width: 100%;
    height: 20% !important;
    position: relative;
    background: var(--secondary-color);
    border-radius: var(--radius-m);
    

  }

  .provider-button {
    width: 100%;
    display: flex;
    align-items: center;
    
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--border-color);
    border-top-left-radius: var(--radius-m);
    border-top-right-radius: var(--radius-m);

    color: var(--text-color);
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-hover);
    }

    &.provider-selected {
      background-color: var(--tertiary-color);
      color: white;
      width: 100% !important;
      // width: 400px !important;
    }
  }

  .provider-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .provider-icon {
    width: 24px;
    height: 24px;
  }

  .provider-name {
    font-size: 16px;
    user-select: none;

  }

  .model-list {
    position: relative;
    border-left: 1px solid var(--tertiary-color);
    border-right: 1px solid var(--tertiary-color);
    border-bottom: 1px solid var(--tertiary-color);
    z-index: 2000;
    margin-left: 0 !important;
    width: auto !important;
    margin-top: 0;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    background: transparent;
    border-bottom-left-radius: var(--radius-m);
    border-bottom-right-radius: var(--radius-m);
    max-height: 300px;
    overflow-y: auto;
    backdrop-filter: blur(10px);
  }

  .model-button {
    padding: var(--spacing-sm);
    background: var(--bg-gradient-left);
    border: none;
    border-radius: var(--radius-l);
    color: var(--text-color);
    font-size: 14px;
    transition: all 0.2s ease;
    z-index: 1000;
    opacity: 0.6;
    width: 100% !important;

    &:hover {
      background: var(--primary-color);
      color: white;
      transform: translateX(2px);
      opacity: 1;
    }

    &.model-selected {
      background-color: #1dff1d;
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

    .icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;

      &.success :global(svg) {
        color: rgb(0, 200, 0);
        stroke: rgb(0, 200, 0);
        fill: none;
      }

      &.error :global(svg) {
        color: rgb(255, 0, 0);
        stroke: rgb(255, 0, 0);
        fill: none;
      }
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
    
      height: 100%;
      width: 100%;
      gap: var(--spacing-sm);
      
    }

    .provider-item {
      height: auto;
    }

    .model-list {
      position: relative;
      z-index: 1000;
      margin-top: var(--spacing-xs);
      padding: var(--spacing-sm);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
      background: var(--bg-gradient-right);
      border-radius: var(--radius-m);
      max-height: 300px;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      
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

.model-list {
  position: relative;
  
  z-index: 1000;
  margin-top: var(--spacing-xs);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  background: var(--bg-gradient-right);
  border-bottom-left-radius: var(--radius-m);
  border-bottom-right-radius: var(--radius-m);

  height: 100%;

  overflow-y: auto;
  backdrop-filter: blur(10px);
}


  .model-button {
    padding: var(--spacing-sm);
    background: var(--bg-alt);
    border: none;
    color: var(--text-color);
    font-size: 14px;
    transition: all 0.2s ease;
    z-index: 1000;
    width: 100%;

    &:hover {
      background: var(--bg-hover);
      color: white;
    }

    &.model-selected {
      background-color: #1dff1d;
      color: white;
    }
  }
}


</style>