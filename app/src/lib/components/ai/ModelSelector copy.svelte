<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { AIModel } from '$lib/types';
    import { Bot } from 'lucide-svelte';
    import { fly } from 'svelte/transition';
    import { availableModels, defaultModel } from '$lib/constants/models';
  
    export let selectedModel: AIModel = defaultModel;
  
    const dispatch = createEventDispatcher<{
      select: AIModel;
    }>();
  
    let isOpen = false;
    let isButtonActive = false;
    let isHovered = false;
  
    function toggleDropdown() {
      isOpen = !isOpen;
    }
  
    function closeDropdown() {
      if (!isOpen) {
        isOpen = false;
      }
    }
  
    function handleModelSelection(model: AIModel) {
      selectedModel = model;
      isOpen = false;
      dispatch('select', model);
    }
</script>
  
<div 
    class="dropdown" 
    on:mouseenter={() => { isOpen = false; isHovered = true; }}
    on:mouseleave={() => { closeDropdown(); isHovered = false; }}
    role="menu"
>
    <button 
      class="dropbtn"
      class:active={isButtonActive}
      class:hovered={isHovered}
      on:click={toggleDropdown}
    >
      <span class="model-name">{selectedModel.name}</span>
      <Bot size={30} />
    </button>
    {#if isOpen}
      <div class="dropdown-content" transition:fly={{ y: 10, duration: 200 }}>
        {#each availableModels as model}
          <button 
            on:click={() => handleModelSelection(model)}
            class="dropdown-item"
          >
            <Bot size={18} />
            {model.name}
          </button>
        {/each}
      </div>
    {/if}
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
  }

    .dropbtn.hovered {
      width: 300px;
      padding-left: 15px;
      padding-right: 15px;
      justify-content: space-between;
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
      
    }
  
    .dropdown-content {
      display: none;
      position: absolute;
      left: 0.5rem;
      bottom: 0;
      /* background-color: #21201d; */
      backdrop-filter: blur(20px);
      background-color: var(--bg-color);
      box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
      padding: 10px;
      border-radius: 10px;
      width: auto;
    }
  
    .dropdown-item {
      padding: 12px 16px;
      text-decoration: none;
      display: block;
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
</style>