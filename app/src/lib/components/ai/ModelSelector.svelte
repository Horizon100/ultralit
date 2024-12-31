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
      return;
    }
    
    currentProvider = provider;

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
              <CheckCircle2 size={16} color="green" class="status-icon success" />
            {:else}
              <XCircle size={16} color="red" class="status-icon error" />
            {/if}
          </div>
        </button>
        
        {#if currentProvider === key && availableProviderModels[key].length > 0}
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
      </div>
    {/each}
  </div>

  {#if showAPIKeyInput}
    <APIKeyInput
      provider={currentProvider ?? ''}
      on:submit={handleAPIKeySubmit}
      on:close={() => showAPIKeyInput = false}
    />
  {/if}
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
    width: 300px;
    border-radius: var(--radius-lg);
    backdrop-filter: blur(10px);
    border-top-right-radius: var(--radius-m);
    transition: all 0,3s ease-in;
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    height: auto;
    position: relative;

  }

  button {
    width: 150px !important;
  }

  .provider-item {
    width: 100%;
    height: 20% !important;
    position: relative;

  }

  .provider-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-color);
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-hover);
    }

    &.provider-selected {
      background-color: var(--tertiary-color);
      color: white;
      width: 94% !important;
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


    z-index: 2000;
    margin-left: 0 !important;
    width: 88% !important;
    margin-top: 0;
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

  .model-button {
    padding: var(--spacing-sm);
    background: var(--bg-alt);
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-color);
    font-size: 14px;
    transition: all 0.2s ease;
    z-index: 1000;
    width: 100% !important;

    &:hover {
      background: var(--bg-hover);
      color: white;
    }

    &.model-selected {
      background-color: #1dff1d;
      color: white;
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
  }

  .status-icon {
    &.success { color: var(--success-color); }
    &.error { color: var(--error-color); }
  }

  @media (max-width: 768px) {

    .selector-container {
      height: auto;
    }

    .providers-list {
      display: flex;
      flex-direction: row;
      height: auto;
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