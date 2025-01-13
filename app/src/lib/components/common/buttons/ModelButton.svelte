<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Key, CheckCircle2, XCircle } from 'lucide-svelte';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { providers } from '$lib/constants/providers';

  export let showKeyInput: boolean;
</script>

<button 
  class="settings-button" 
  on:click={() => showKeyInput = !showKeyInput}
  transition:fly={{ y: -200, duration: 300}}
>
  <Key size={24} />
  <div class="key-statuses">
      {#each Object.entries(providers) as [provider, config]}
          <div class="provider-status">
              <div class="provider-info">
                  <img src={config.icon} alt={config.name} class="provider-icon" />
                  <span class="provider-name">{config.name}</span>
              </div>
              <div class="status-wrapper">
                  {#if $apiKey[provider]}
                      <CheckCircle2 size={16} class="status-icon success" />
                  {:else}
                      <XCircle size={16} class="status-icon error" />
                  {/if}
              </div>
          </div>
      {/each}
  </div>
</button>

<style lang="scss">
    	@use "src/styles/themes.scss" as *;

        .settings-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        width: auto;
        height: 60px;
        background: red;
        border: 1px solid var(--border-color);
        color: var(--text-color);
        transition: all 0.2s ease;

        &:hover {
            transform: translateY(-4px);
            background: var(--bg-gradient);
        }

        span {
            font-size: 0.9rem;
        }
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
    

  .provider-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
  }

  .provider-icon {
      width: 20px;
      height: 20px;
  }

  .provider-name {
      font-size: 0.9rem;
      white-space: nowrap;
      color: red;
      user-select: ;
  }

  .status-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
  }

img {
      color: white;
    }
  
  
    .status-icon {
      &.success { color: var(--success-color); }
      &.error { color: var(--error-color); }
    }


</style>