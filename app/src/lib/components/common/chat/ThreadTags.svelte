<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly, slide } from 'svelte/transition';
    import { Tag, Tags } from 'lucide-svelte';
    import type { Tag } from '$lib/types';
  
    export let availableTags: Tag[] = [];
    export let currentThreadId: string | null = null;
    export let showTagSelector = false;
    export let isTags = true;
  
    const dispatch = createEventDispatcher();
  
    function toggleTagSelector() {
      showTagSelector = !showTagSelector;
      isTags = !isTags;
      dispatch('toggleSelector');
    }
  
    function toggleTag(tag: Tag) {
      dispatch('toggleTag', { tag });
    }
  </script>
  
  <div class="tag-row" transition:fly="{{ x: -300, duration: 300 }}">
    {#if currentThreadId}
      {#if showTagSelector}
        <div class="tag-selector" transition:fly="{{ x: 20, duration: 500 }}">
          {#each availableTags as tag (tag.id)}
            <div class="tag-item" transition:fly="{{ x: 20, duration: 50 }}">
              <button 
                class="tag" 
                class:selected={tag.selected_threads?.includes(currentThreadId)}
                on:click={() => toggleTag(tag)}
                style="background-color: {tag.color}"
              >
                {tag.name}
                {#if tag.selected_threads?.includes(currentThreadId)}
                  <span class="checkmark">✓</span>
                {/if}
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="assigned-tags" on:click={toggleTagSelector} transition:fly="{{ x: -300, duration: 300 }}">
          {#each availableTags.filter(tag => tag.selected_threads?.includes(currentThreadId)) as tag (tag.id)}
            <span class="tag" style="background-color: {tag.color}">{tag.name}</span>
          {/each}
        </div>
      {/if}
      <button on:click={toggleTagSelector} class="tag-selector-toggle" transition:fly="{{ x: -300, duration: 300 }}">
        {#if isTags}
          <Tag size={20} />
        {:else}
          <Tags size={24} />
        {/if}
      </button>
    {/if}
  </div>
  
  <style lang="scss">
    
    .tag-row {
      display: flex;
      flex-wrap: nowrap;
      justify-content: right;
      align-items: right;
      gap: 5px;
      margin-top: 1rem;
      border-radius: 20px;
      transition: all ease 0.3s;
      margin-right: 2rem;
  
      &:hover {
        display: flex;
        flex-wrap: nowrap;
        justify-content: right;
      }
    }
  
    .tag-selector {
      display: flex;
      flex-wrap: wrap;
      justify-content: right;
      align-items: center;
      gap: 5px;
      width: auto;
      border-radius: 20px;
      transition: all ease 0.3s;
    }
  
    .assigned-tags {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      transition: all 0.3s ease;
      justify-content: flex-end;
    }
  
    .tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 16px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: rgb(255, 255, 255);
      transition: all 0.1s ease;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255, 255, 255, 0) 50%);
      
      &:hover {
        opacity: 0.8;
        transform: scale(1.1);
      }
  
      &.selected {
        box-shadow: 0 0 0 2px rgb(51, 121, 105);
        font-weight: bolder;
        width: auto;
        height: auto;
        color: white;
      }
    }
  
    .tag-selector-toggle {
      background: none;
      border: none;
      cursor: pointer;
      color: white;
      position: absolute;
      right: 0;
      top: 0.5rem;
  
      &:hover {
        color: rgb(69, 171, 202);
        background-color: transparent;
      }
    }
  
    .tag-edit-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 2px;
      border-radius: 15px;
      margin-left: 1rem;
      
      input {
        width: 80%;
        background-color: var(--primary-color);
        color: var(--text-color);
      }
    }
  
    .tag-edit-buttons {
      display: flex;
      width: auto;
      gap: 20px;
    }
  
    .edit-tag,
    .save-tag-button,
    .delete-tag-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      margin-left: 2px;
      color: var(--text-color);
      opacity: 0.7;
      transition: all ease 0.3s;
  
      &:hover {
        opacity: 1;
        transform: scale(1.1);
      }
    }
  
    .delete-tag-button:hover {
      color: rgb(255, 0, 0);
    }
  
    .new-tag-input {
      display: flex;
      margin-bottom: 10px;
      width: 500px;
      margin-left: 0;
  
      input {
        flex-grow: 1;
        border: 1px solid #ccc;
        border-radius: 15px;
        background-color: var(--secondary-color);
        padding: 5px 10px;
        font-size: 16px;
        color: white;
        width: 100%;
      }
    }
  
    .new-tag {
      border: none;
      cursor: pointer;
      display: flex;
      position: relative;
      justify-content: right;
      transition: all ease 0.3s;
      border-radius: 50%;
      width: auto;
      height: auto;
  
      &:hover {
        background-color: var(--tertiary-color);
        color: var(--text-color);
        transform: scale(1.1);
      }
    }

    .thread-tags {
    display: flex;
    flex-direction: row;
    gap: 20px;
    /* height: 40px; */
    /* z-index: 1000; */
    user-select: none;
  }
  </style>