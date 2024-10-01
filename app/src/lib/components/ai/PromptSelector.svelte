<script lang="ts">
  import type { PromptType } from '$lib/types';
  import { fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { availablePrompts } from '$lib/constants/prompts';

  let selectedPrompt: PromptType = 'CASUAL_CHAT';
  let selectedIcon = availablePrompts.find(option => option.value === selectedPrompt)?.icon;
  let isOpen = false; 
  let isButtonActive = false;  
  let isHovered = false;

  const dispatch = createEventDispatcher<{
    select: PromptType;
  }>();

  function handlePromptSelection(promptType: PromptType) {
    selectedPrompt = promptType;
    const selectedOption = availablePrompts.find(option => option.value === promptType);
    if (selectedOption) {
      selectedIcon = selectedOption.icon;
    }
    isOpen = false;
    dispatch('select', promptType);
  }

  function toggleDropdown() {
    isOpen = !isOpen; 
  }

  function closeDropdown() {
    if (!isOpen) {  
      isOpen = false;
    }
  }

  $: selectedPromptLabel = availablePrompts.find(option => option.value === selectedPrompt)?.label || '';
</script>

<div 
  class="dropdown" 
  on:mouseenter={() => { isHovered = true; }}
  on:mouseleave={() => { closeDropdown(); isHovered = false; }}
  role="menu"
>
  <button 
    class="dropbtn"
    class:active={isButtonActive} 
    class:hovered={isHovered}
    on:click={toggleDropdown}
  >
    <span class="prompt-name">{selectedPromptLabel}</span>
    {#if selectedIcon}
      <svelte:component this={selectedIcon} size={40} />
    {/if}
  </button>
  {#if isOpen}
    <div class="dropdown-content" transition:fly={{ y: 10, duration: 200 }}>
      {#each availablePrompts as { value, label, icon: Icon }}
        <button 
          on:click={() => handlePromptSelection(value)}
          class="dropdown-item"
        >
          <Icon size={18} />
          {label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropbtn {
    background-color: #283428;
    color: white;
    padding: 4px;
    font-size: 16px;
    border: none;
    cursor: pointer;
    border-radius: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 60px;
    height: 60px;
    padding: 10px;
    border: 2px solid #506262;
    transition: all 0.3s ease-in-out;
    overflow: hidden;
  }

  .dropbtn.hovered {
    width: auto;
    justify-content: right;
  }

  .prompt-name {
    display: none;
    margin-right: 10px;
    white-space: nowrap;
  }

  .dropbtn.hovered .prompt-name {
    display: inline;
  }

  .dropdown {
    position: relative;
    display: flex;
  }

  .dropdown-content {
    display: none;
    position: absolute;
    bottom: 5rem;
    background-color: #21201d;
    min-width: 300px;
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    z-index: 1;
    padding: 10px;
    border-radius: 10px;
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
    background-color: #3e8e41;
  }

  .dropdown:hover .dropbtn.active {
    background-color: red;
  }

  button {
    background-color: #21201d;
    color: rgb(116, 116, 116);
    border: none;
    transition: all 0.3s ease-in-out;
    border-radius: 10px;
    justify-content: center;
    align-items: center;
  }

  button:hover {
    background-color: #21201d;
    color: white;
    border-radius: 10px;
  }
</style>