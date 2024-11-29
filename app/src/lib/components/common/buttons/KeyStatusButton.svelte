<script lang="ts">
    import { fly } from 'svelte/transition';
    import { Key, CheckCircle2, XCircle } from 'lucide-svelte';
    import { apiKey } from '$lib/stores/apiKeyStore';
    
    export let showKeyInput: boolean;
    
    const providers = {
      openai: { name: 'OpenAI' },
      anthropic: { name: 'Claude' },
      google: { name: 'Gemini' },
      grok: { name: 'Grok' }
    };
    </script>
    
    <button 
      class="settings-button" 
      on:click={() => showKeyInput = !showKeyInput}
      transition:fly={{ y: -200, duration: 300}}
    >
    <Key size={24} />

      <div class="key-statuses">
        {#each Object.entries(providers) as [provider, {name}]}
          <div class="provider-status">
            <span>{name}</span>
            {#if $apiKey[provider]}
              <CheckCircle2 size={16} color="green" class="status-icon success" />
            {:else}
              <XCircle size={16} color="red" class="status-icon error" />
            {/if}
          </div>
        {/each}
      </div>
    </button>
    
    <style lang="scss">

.settings-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        width: auto;
        height: 60px;
        background: var(--bg-gradient);
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
    
    .status-icon {
      &.success { color: var(--success-color); }
      &.error { color: var(--error-color); }
    }
    </style>