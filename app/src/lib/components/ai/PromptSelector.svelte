<script lang="ts">
import type { PromptType } from '$lib/types/types';
import { fly } from 'svelte/transition';
import { createEventDispatcher } from 'svelte';
import { availablePrompts } from '$lib/constants/prompts';
import { promptStore } from '$lib/stores/promptStore';

let selectedPrompt: PromptType;
$: selectedPrompt = $promptStore;

let selectedIcon = availablePrompts.find(option => option.value === selectedPrompt)?.icon;
let isOpen = false; 
let isButtonActive = false;  
let isHovered = false;





const dispatch = createEventDispatcher<{
  select: PromptType;
  auxclick: PromptType;  // Add this type
}>();

function handleMouseDown(event: MouseEvent) {
  console.log("Mouse button pressed:", event.button);
  if (event.button === 1) { // Middle button
    event.preventDefault();
    console.log("Middle button press detected");
    if (selectedPrompt) {
      dispatch('select', selectedPrompt);
      isButtonActive = true;
    }
  }
}

function handleMouseUp(event: MouseEvent) {
  console.log("Mouse button released:", event.button);
  if (event.button === 1) {
    isButtonActive = false;
  }
}
function handleAuxClick(event: MouseEvent) {
  if (event.button === 1) {
    event.preventDefault();
    console.log("PromptSelector: Middle click detected");
    if (selectedPrompt) {
      console.log("PromptSelector: Dispatching auxclick with prompt:", selectedPrompt);
      dispatch('auxclick', selectedPrompt);  // Dispatch auxclick instead of select
      isButtonActive = true;
    }
  }
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  console.log("Right click detected");
  if (selectedPrompt) {
    console.log("Dispatching select with prompt:", selectedPrompt);
    dispatch('select', selectedPrompt);
    isButtonActive = true;
  }
}

function handleMouseLeave() {
  isButtonActive = false;
  closeDropdown();
  isHovered = false;
}


function closeDropdown() {
  isOpen = false;
}



function handlePromptSelection(promptType: PromptType) {
  selectedPrompt = promptType;
  promptStore.set(promptType);
  selectedIcon = availablePrompts.find(option => option.value === promptType)?.icon;
  isOpen = false;
  dispatch('select', promptType);
  }

  // Watch for changes in store
  $: {
    if ($promptStore) {
      selectedIcon = availablePrompts.find(option => option.value === $promptStore)?.icon;
      console.log('Prompt selector updated from store:', {
        prompt: $promptStore,
        icon: selectedIcon ? 'Icon updated' : 'No icon'
      });
    }
  }

  function toggleDropdown() {
    isOpen = !isOpen;
    console.log('Dropdown toggled, isOpen:', isOpen);
  }

  // function closeDropdown() {
  //   if (!isOpen) {  
  //     isOpen = false;
  //   }
  // }

  // Watch for changes in selectedPrompt
  $: {
  if ($promptStore) {
    selectedIcon = availablePrompts.find(option => option.value === $promptStore)?.icon;
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
  on:mousedown|preventDefault={handleMouseDown}
  on:mouseup|preventDefault={handleMouseUp}
  on:mouseleave={handleMouseLeave}
>
  <span class="prompt-name">{selectedPromptLabel}</span>
  {#if selectedIcon}
    <svelte:component this={selectedIcon} size={40} />
  {/if}
</button>
  {#if isOpen}
    <div class="dropdown-content" transition:fly={{ y: 10, duration: 200 }}>
      {#each availablePrompts as { value, label, icon: Icon }}
        <button on:click={() => handlePromptSelection(value)}>
          <Icon size={18} />
          {label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
	@use "src/styles/themes.scss" as *;
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
    position: relative;
    justify-content: center;
    align-items: center;
    width: 50px;
    height: 50px;
    padding: 0.5rem;
    /* border: 2px solid #506262; */
    transition: transform 0.2s ease;
    overflow: hidden;
    user-select: none;
  }




.dropbtn.active {
  transform: scale(0.9);
}

    .dropbtn.hovered {
      width: 300px;
      padding-left: 15px;
      padding-right: 15px;
      justify-content: space-between;

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

  .dropbtn.pressing {
  transition: transform 1.4s linear;
  transform: scale(0.95);
}

  .dropdown-content {
      display: none;
      position: absolute;
      align-items: left;
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
    left: 0;
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