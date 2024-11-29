<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X } from 'lucide-svelte';
  import { fly } from 'svelte/transition';

  export let provider: string;

  const dispatch = createEventDispatcher<{
      submit: string;
      close: void;
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
      if (!target.closest('form')) {
          dispatch('close');
      }
  }
</script>

<div 
  class="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
  on:click={handleClickOutside}
  transition:fly={{ y: -20, duration: 200 }}
>
  <form 
      on:submit={handleSubmit}
      class="bg-primary rounded-lg p-6 w-full max-w-md"
      transition:fly={{ y: 20, duration: 200 }}
  >
      <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold">Enter {provider} API Key</h2>
          <!-- <button 
              type="button" 
              on:click={() => dispatch('close')}
              class="text-gray-500 hover:text-gray-700"
          >
              <X size={24} />
          </button> -->
      </div>

      <div class="space-y-4">
          <input
              type="password"
              bind:value={key}
              class="w-full px-4 py-2 rounded-lg bg-secondary"
              placeholder="Enter your API key"
              autofocus
          />
          
          <button
              type="submit"
              class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
              Save Key
          </button>
      </div>
  </form>
</div>

<style lang="scss">
  form {
      background: var(--bg-color);
      border: 1px solid var(--border-color);
  }

  input {
      width: 100%;
      padding: 0.75rem;
      padding-right: 3rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      font-size: 1rem;
      background: var(--background);
      color: var(--text-color);
    }
  
    input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px var(--primary-color-transparent);
      z-index: 1000;
    }
  button {
      background: var(--primary-color);
      color: var(--text-color);
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


  
</style>