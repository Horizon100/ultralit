<script lang="ts">
  import { promptOptions } from '$lib/constants/prompts';
  import type { PromptType } from '$lib/types';
  import { fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';


  let selectedPrompt: PromptType = 'CASUAL_CHAT';
  let selectedIcon = promptOptions.find(option => option.value === selectedPrompt)?.icon;
  let isOpen = false;  // Track if dropdown is open
  let isButtonActive = false;  // Track if the button is active

  const dispatch = createEventDispatcher();


  function handlePromptSelection(promptType: PromptType) {
    selectedPrompt = promptType;
    const selectedOption = promptOptions.find(option => option.value === promptType);
    if (selectedOption) {
      selectedIcon = selectedOption.icon;
    }
    isOpen = false;
    dispatch('select', promptType);
  }

  function toggleDropdown() {
      isOpen = !isOpen;  // Toggle dropdown state
  }

  function closeDropdown() {
    if (!isOpen) {  // Only close if it's not manually opened
        isOpen = false;
    }
  }

  
</script>

<div 
  class="dropdown" 
  on:mouseenter={() => isOpen = true} 
  on:mouseleave={closeDropdown}
  role="menu"
>
  <button 
    class="dropbtn"
    class:active={isButtonActive} 
    on:click={toggleDropdown}
  >
    {#if selectedIcon}
      <svelte:component this={selectedIcon} size={24} />
    {/if}
  </button>
  {#if isOpen}
    <div class="dropdown-content" transition:fly={{ y: 10, duration: 200 }}>
      {#each promptOptions as { value, label, icon: Icon }}
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
    /* Style The Dropdown Button */
    .dropbtn {
      background-color: #161d16;
      color: white;
      padding: 4px;
      font-size: 16px;
      border: none;
      cursor: pointer;
      border-radius: 20px;
      justify-content: center;
      align-items: center;
      width: auto;
      height: 50px;
      width: 50px;
      border: 2px solid #506262;
    }

 
    /* The container <div> - needed to position the dropdown content */
    .dropdown {
      position: relative;
      display: flex;
      /* height: auto; */
      /* height: 60px; */

      
    }
    
    /* Dropdown Content (Hidden by Default) */
    .dropdown-content {
      display: none;
      position: absolute;
      bottom: 3rem;
      background-color: #21201d;
      min-width: 300px;
      /* margin-top: 20px; */
      box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
      z-index: 1;
      padding: 10px;
      border-radius: 10px;

    }
    
    /* Links inside the dropdown */
    .dropdown-item {
      /* color: white; */
      padding: 12px 16px;
      text-decoration: none;
      display: block;
    }
    

    /* Show the dropdown menu on hover */
    .dropdown:hover .dropdown-content {
      display: block;
      right: 0;
    }
    
    /* Change the background color of the dropdown button when the dropdown content is shown */
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
      /* border: 1px solid white; */
      border-radius: 10px;
      /* font-weight: bold; */
    }
    
    </style>