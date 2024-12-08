<script lang="ts">
  import type { PromptType } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import { availablePrompts } from '$lib/constants/prompts';
  import { promptStore } from '$lib/stores/promptStore'; // Create this store
  import { fly } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  // Use the store value instead of local state
  $: selectedPrompt = $promptStore;
  $: selectedIcon = availablePrompts.find(option => option.value === selectedPrompt)?.icon;
  
  let isOpen = false;
  let isHovered = false;
  let isFullScreen = false;
  let activeDetails = null;
  const dispatch = createEventDispatcher<{
    select: PromptType;
  }>();



  function handlePromptSelection(promptType: PromptType) {
  console.log('PromptCatalog - Previous prompt:', selectedPrompt);
  selectedPrompt = promptType;
  console.log('New prompt selected:', promptType);
  const selectedOption = availablePrompts.find(option => option.value === promptType);
  if (selectedOption) {
    selectedIcon = selectedOption.icon;
    console.log('Icon updated to:', selectedOption.label);
  }
  // Update the store instead of local state
  promptStore.set(promptType);
  
  // Immediately show fullscreen
  isFullScreen = true;
  activeDetails = selectedOption;
  
  console.log('PromptCatalog - New prompt selected:', promptType);
  
  isOpen = false;
  dispatch('select', promptType);  
}



  function toggleFullScreen(promptType: PromptType) {
    if (selectedPrompt === promptType && !isFullScreen) {
      // Expand to full screen
      isFullScreen = true;
      activeDetails = availablePrompts.find(p => p.value === promptType);
    } else {
      // Return to grid view
      isFullScreen = false;
      activeDetails = null;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    // Check if click is on the backdrop
    const target = event.target as HTMLElement;
    if (isFullScreen && target.classList.contains('backdrop')) {
      isFullScreen = false;
      activeDetails = null;
    }
  }

  function handleClose(event: MouseEvent) {
    event.stopPropagation(); // Prevent event from bubbling up
    isFullScreen = false;
    activeDetails = null;
  }
    

    $: {
    if (selectedPrompt) {
      console.log('Current prompt state:', {
        prompt: selectedPrompt,
        label: selectedPromptLabel,
        icon: selectedIcon ? 'Icon present' : 'No icon'
      });
    }
  }

  $: selectedPromptLabel = availablePrompts.find(option => option.value === selectedPrompt)?.label || '';
</script>

<div class="prompt-overlay">
  <div 
    class="prompt-grid-container" 
    role="menu" 
    class:fullscreen={isFullScreen}
  >
    <div 
      class="backdrop" 
      class:visible={isFullScreen} 
      on:click={handleClickOutside}
    ></div>
    
    {#each availablePrompts as { value, label, icon: Icon, description, youtubeUrl }}

    <div 
        class="prompt-grid-item"
        class:active={selectedPrompt === value}
        class:fullscreen={isFullScreen && selectedPrompt === value}
        class:hidden={isFullScreen && selectedPrompt !== value}
        on:click|stopPropagation={() => handlePromptSelection(value)}
      >
        {#if isFullScreen && selectedPrompt === value}
          <button 
            class="close-button" 
            on:click={handleClose}
          >
            <X/>
          </button>
        {/if}
        <div class="content-wrapper" class:fullscreen={isFullScreen && selectedPrompt === value}>
          <div class="content-header" transition:fly={{ x: 20, duration: 300, delay: 200 }}>
            <Icon size={isFullScreen && selectedPrompt === value ? 20 : 20} />
          </div>
          {#if isFullScreen && selectedPrompt === value && youtubeUrl}
            <div class="video-container" transition:fly={{ x: 20, duration: 300, delay: 200 }}>

              <iframe 
                width="560" 
                height="315" 
                src={youtubeUrl}
                title="YouTube video player" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
              ></iframe>
            </div>
            <h3>{label}</h3>

            <p class="description">{description}</p>

          {/if}

        </div>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
	@use "src/themes.scss" as *;

    * {
		font-family: var(--font-family);
        /* font-family: 'Merriweather', serif; */
        /* font-family: Georgia, 'Times New Roman', Times, serif; */
    }  

  .prompt-overlay {
    display: flex;
    position: relative;
    height: auto;
    width: auto;
    justify-content: center;
    align-items: center;
    
    &.fullscreen {
      margin-top: 4rem;

    } 
    
  }
  .backdrop {
    display: flex;
    position: absolute;
    height: 100%;
    width: 100%;
    justify-content: center;
    align-items: center;
    opacity: 0;
    border-radius: 20px;
    pointer-events: none;
    transition: opacity 0.3s ease;
    // z-index: 1;

    &.visible {
      opacity: 1;
      pointer-events: auto;
    }
  }
  .prompt-grid-container {
    display: flex;
    justify-content: left;
    flex-wrap: wrap;

    overflow-y: auto;
    width: 100%;
    height: 100%;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    scrollbar-width: thin;
    scrollbar-color: var(--bg-color) transparent;

    &.fullscreen {
      color: var(--secondary-color);

    }
  }


  .prompt-grid-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    text-align: center;
    background: var(--bg-gradient-r);
    cursor: pointer;
    position: relative;
    user-select: none;
    width: 50px; 
    height: 50px;
    opacity: 0.3;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    /* Remove flex-wrap from item since it should be on container */
    /* Remove flex property since we're using fixed width/height */


    // color: var(--text-color);


    &.fullscreen {
      position: relative;
      flex-direction: column;

      top: 0;
      left: 0;
      // transform: translate(-50%, 0%);
      // width: 300px;
      height: auto;
      width: 100%;
      max-width: none;
      margin: 0;
      background: var(--bg-gradient-r);
      z-index: 2;
      border: 1px solid var(--tertiary-color);
      color: var(--text-color);
      opacity: 1;
      cursor: default; 
      pointer-events: none;


    }

    &.hidden {
      opacity: 0;
      pointer-events: none;
      transform: scale(0.95);
      transition: all 0.3s ease;
      height: 0;
    }

  }

  .prompt-grid-item.active {
    background: var(--secondary-color);
    backdrop-filter: blur(20px);
    opacity: 1;
    
  }


  .prompt-grid-item:hover {
    // transform: scale(0.98) translateY(-10px);
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    opacity: 0.75;



  }

  .prompt-grid-item h3 {
    margin-bottom: 1rem;
    color: var(--text-color);
    font-size: 1rem;
    text-align: left;
  }

  /* Active state for selected grid items */
  .prompt-grid-item.selected {
    border: 1px solid var(--secondary-color);
      color: var(--text-color);
      
  }

  .prompt-label {
    margin-top: 10px;
    font-size: 14px;
    text-align: center;
  }

  .content-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: left;
    gap: 1rem;

  }

  .content-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: left;
    width: 100%;
    height: 100%;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 1rem;

    gap: 1rem;

    &.fullscreen {
      justify-content: center;
      flex-direction: column;
      margin-top: 1rem;

      h3 {
        // font-size: 2.5rem;
        width: 100%;
      }

      .content-header {
        display: none;
      }

      .description {
        // font-size: 1.5rem;
        margin: 0 0 1rem;
        width: 90%;        
      }

      .video-container {
        // margin-top: 0;
      }
      
    }
  }

  .details {
    opacity: 0;
    animation: fadeIn 0.3s forwards;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    color: white;
    display: flex;
  

  }

  .description {
    font-size: 0.8rem;
    line-height: 2;
    text-align: left;
    color: var(--text-color);

  }

  .close-button {
    position: fixed;
    top: 0;
    right: 0;
    border-radius: 50%;
    height: 30px;
    width: 30px;
    background: none;
    color: white;
    // border: 1px solid rgba(255, 255, 255, 0.2);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    pointer-events: auto;
        
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
  .video-container {
    width: 100%;
    max-width: 1200px;
    position: relative;
    padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
    height: 0;
    overflow: hidden;
    pointer-events: auto; // Enable interaction with video

    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 90%;
      height: 100%;
      border-radius: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 1000px) {
    .prompt-overlay {
      margin-left: auto;
      height: 84%;

    }
    .prompt-grid-item {
      flex: 1 1 calc(50% - 1rem); /* Adjust to take up more space on smaller screens */
    }
  }

  @media (max-width: 600px) {
    .prompt-grid-item {
      flex: 1 1 calc(100% - 1rem); /* Each item takes full width on very small screens */
    }
  }

  @media (max-width: 768px) {
    .prompt-grid-item.fullscreen {
      width: 100%;
      height: 50%;
      border-radius: 0;
    }

    .content-wrapper.fullscreen {
      h3 {
        font-size: 2rem;
      }
    }

    .description {
      font-size: 1rem;
    }
  }
</style>