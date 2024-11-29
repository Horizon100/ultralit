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

  export let selectedModel: AIModel = defaultModel;

  const dispatch = createEventDispatcher<{
      select: AIModel;
  }>();

  let isOpen = false;
  let currentProvider: ProviderType | null = null;
  let showAPIKeyInput = false;
  let availableProviderModels: Record<ProviderType, AIModel[]> = {
    openai: [],
    anthropic: [],
    google: [],
    grok: []
};
  function toggleDropdown() {
      isOpen = !isOpen;
  }

  async function handleProviderClick(key: string) {
    const provider = key as ProviderType;
    const currentKey = get(apiKey)[provider];
    currentProvider = provider;

    if (!currentKey) {
        showAPIKeyInput = true;
    } else {
        if ($currentUser) {
            await modelStore.setSelectedProvider($currentUser.id, provider);
        }
        await loadProviderModels(provider);
        showAPIKeyInput = false;

    }

    // Only close the dropdown if no model list is open or if switching providers
    if (!availableProviderModels[provider].length) {
        isOpen = false;
    }
}

  async function loadProviderModels(provider: ProviderType) {
      const currentKey = get(apiKey)[provider];
      if (currentKey) {
          try {
              availableProviderModels[provider] = await providers[provider].fetchModels(currentKey);
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

  async function handleModelSelection(model: AIModel) {
      selectedModel = model;
      if ($currentUser) {
          await modelStore.setSelectedModel($currentUser.id, model.id);
      }
      isOpen = false;
      dispatch('select', selectedModel);
  }
</script>

<div 
    class="dropdown"
    role="menu"
>



    {#if isOpen}
        <div class="dropdown-content" transition:fly={{ y: 10, duration: 200 }}>
            {#each Object.entries(providers) as [key, provider]}
              <div class="provider-button">
                <button class="provider-snippet"
                    on:click={() => handleProviderClick(key)}
                    class:provider-selected={currentProvider === key}
                    transition:fly={{ y: -100, duration: 200 }}
                >
                    <img src={provider.icon} alt={provider.name} class="provider-icon" />
                    {provider.name}
                </button>
                <div class="provider-status">
                    {#if $apiKey[key]}
                        <CheckCircle2 size={16} color="green" class="status-icon success" />
                    {:else}
                        <XCircle size={16} color="red" class="status-icon error" />
                    {/if}
                </div>
              </div>
            {/each}

            {#if currentProvider && availableProviderModels[currentProvider]}
                <div class="model-list">
                    {#each availableProviderModels[currentProvider] as model}
                        <button 
                            on:click={() => handleModelSelection(model)}
                            class="dropdown-item"
                            class:model-selected={selectedModel.id === model.id}
                            transition:fly={{ y: -100, duration: 200 }}
                        >
                            {model.name}
                        </button>
                    {/each}
                </div>
            {/if}
            
            {#if showAPIKeyInput}
                <APIKeyInput
                    provider={currentProvider ?? ''}
                    on:submit={handleAPIKeySubmit}
                    on:close={() => showAPIKeyInput = false}
                />
            {/if}
        </div>
    {/if}

    <button 
      class="dropbtn"
      on:click={toggleDropdown}
  >
      <span class="model-name">{selectedModel.name}</span>
      {#if selectedModel.provider && providers[selectedModel.provider]}
          <img 
              src={providers[selectedModel.provider].icon} 
              alt={providers[selectedModel.provider].name} 
              class="provider-icon"
          />
      {:else}
          <Bot size={30} />
      {/if}
      {#if get(apiKey)[selectedModel.provider]}
          <Settings class="gear-icon" size={18} on:click={() => showAPIKeyInput = true} />
      {/if}
  </button>
</div>

<style lang="scss">
  @use "src/themes.scss" as *;

* {
    /* font-family: 'Merriweather', serif; */
    /* font-family: 'Roboto', sans-serif; */
    /* font-family: 'Montserrat'; */
    /* color: var(--text-color); */
    font-family: var(--font-family);

  }
  .provider-icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
}

  .rotate-180 {
      transform: rotate(180deg);
  }

  .model-selector {
      position: relative;
      z-index: 50;
  }

  button {
      width: 100%;
      text-align: left;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      
      &:hover {
          background: var(--bg-hover-color);
      }
  }

  img.provider-icon {
  color: white;
  stroke: 1px solid white;
  }

.dropbtn {
  /* background-color: #283428; */
  color: var(--text-color);
  background: var(--bg-gradient-right);
  padding: 4px;
  font-size: 16px;
  border: none;
  cursor: pointer;
  border-radius: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
  padding: 0.5rem;
  /* border: 2px solid #506262; */
  transition: all 0.3s ease-in-out;
  overflow: hidden;
  user-select: none;
  position: relative;

  
    .provider-icon {
      width: 30px;
      height: 30px;
      transition: all 0.3s ease-in-out;

  }
}

.dropbtn.hovered {
  width: 300px;
  padding-left: 15px;
  padding-right: 15px;
  justify-content: space-between;

  .provider-icon {
      width: 24px;
      height: 24px;
  }
}

  .model-name {
    display: none;
    margin-right: 10px;
    white-space: nowrap;
  }

  .dropbtn.hovered .model-name {
    display: inline;
  }

  .dropdown {
    position: relative;
    display: flex;
    flex-direction: column-reverse;
    transform-origin: bottom center; /* Adjust the transition origin */

  }

  .dropdown {
    position: relative;
    display: flex;
    transform-origin: bottom center;
}

.dropdown-content {
    display: none;
    position: absolute;
    left: 0.5rem;
    bottom: 0;
    backdrop-filter: blur(20px);
    background-color: var(--bg-color);
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    padding: 10px;
    border-radius: 10px;
    width: 300px;
}

.provider-section {
    display: flex;
    flex-direction: column-reverse; /* Reverse the order of providers */
    gap: 8px;
}

button {
    background-color: transparent;
    color: rgb(116, 116, 116);
    border: none;
    transition: all 0.3s ease-in-out;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: left;
    width: 100%;
    padding: 8px;
    cursor: pointer;
}

button:hover {
    background-color: #21201d;
    color: white;
    border-radius: 10px;
}

button.provider-selected {
    background-color: #1d6bff; /* Highlight active provider */
    color: white;
}

button.model-selected {
    background-color: #1dff1d; /* Highlight active model */
    color: white;
}

.model-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    padding: var(--spacing-md);
    border-radius: var(--radius-m);
    // border: 1px solid var(--primary-color);
    background: var(--bg-gradient-right);
}

.dropdown:hover .dropdown-content {
    display: flex;
}

  .dropdown-item {
    padding: 12px 16px;
    text-decoration: none;
    display: block;
  }

  .dropdown-item2 {
    padding: 12px 16px;
    text-decoration: none;
    display: flex;
    position: relative;
    left: 200px;
    background-color: red;
  }

  .dropdown:hover .dropdown-content {
    display: block;
    right: 0;
  }

  .dropdown:hover .dropbtn {
    background-color: #050705;
  }

  .dropdown:hover .dropbtn.active {
    background-color: red;
  }

  button {
    background-color: transparent;
    color: rgb(116, 116, 116);
    border: none;
    transition: all 0.3s ease-in-out;
    border-radius: 10px;
    justify-content: left;
    align-items: center;
    width: 100%;
  }

  button:hover {
    background-color: #21201d;
    color: white;
    border-radius: 10px;
  }

  @media (max-width: 768px) {
  .dropbtn.hovered {
    width: 90vw;
    padding-left: 15px;
    padding-right: 15px;
    justify-content: space-between;

  }
}

    .model-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .dropdown-item {
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--item-bg);
        cursor: pointer;
    }

    .key-statuses {
      display: flex;
      flex-direction: row;
      gap: 0.5rem;
    }
    
    .provider-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    
    .status-icon {
      &.success { color: var(--success-color); }
      &.error { color: var(--error-color); }
    }

    .provider-button {
      display: flex;
      flex-direction: row;
      gap: var(--spacing-md);
    }
    .provider-snippet {
      font-size: var(--font-size-s);
    }
</style>