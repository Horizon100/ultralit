<script lang="ts">
  import type { PromptType } from '$lib/types/types';
  import { createEventDispatcher } from 'svelte';
  import { availablePrompts } from '$lib/constants/prompts';
  import { promptStore } from '$lib/stores/promptStore';
  import { fly } from 'svelte/transition';

  // Use the store value
  $: selectedPrompt = $promptStore;
  $: selectedIcon = availablePrompts.find(option => option.value === selectedPrompt)?.icon;
  
  const dispatch = createEventDispatcher<{
    select: PromptType;
  }>();

  function handlePromptSelection(promptType: PromptType) {
    selectedPrompt = promptType;
    const selectedOption = availablePrompts.find(option => option.value === promptType);
    if (selectedOption) {
      selectedIcon = selectedOption.icon;
    }
    promptStore.set(promptType);
    dispatch('select', promptType);
  }

  $: selectedPromptLabel = availablePrompts.find(option => option.value === selectedPrompt)?.label || '';
</script>

<div class="prompt-overlay">
  <div class="prompt-grid-container" role="menu">
    {#each availablePrompts as { value, label, icon: Icon, description, youtubeUrl }}
      <div 
        class="prompt-grid-item"
        class:active={selectedPrompt === value}
        on:click|stopPropagation={() => handlePromptSelection(value)}
      >
        <div class="icon-wrapper">
          <Icon size={20} color="var(--text-color)" />
        </div>
        <h3>{label}</h3>
      </div>
      <div class="content-wrapper">
        <div class="content-header">
        </div>
        
        {#if selectedPrompt === value}
        <p class="description" transition:fly={{ y: 20, duration: 300 }}>
          {description}
        </p>
          {#if youtubeUrl}
            <div class="video-container" transition:fly={{ y: -20, duration: 300 }}>
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
          {/if}
        {/if}
      </div>
    {/each}
  </div>
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
  .prompt-overlay {
    display: flex;
    position: relative;
    border-top-left-radius: var(--radius-m);
    width: 100%;
    justify-content: center;
    align-items: center;
    margin-bottom: 1rem;
    background: var(--bg-gradient-r);
    // backdrop-filter: blur(100px);
    border-radius: var(--radius-m);
  }

  .prompt-grid-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    height: auto;
    // box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
    // backdrop-filter: blur(100px);
    margin: 1rem;
    padding: 1rem;
    border-radius: var(--radius-m);
  }

  .prompt-grid-item {
    display: flex;
    width: 50%;
    margin-right: 50% !important;
    padding: 1.2rem 0;
    border-radius: var(--radius-m);
    background: var(--bg-color);
    border-bottom: 1px solid var(--secondary-color);
    cursor: pointer;
    gap: 1rem;
    padding-left: 1rem;
    transition: all 0.3s ease;
    &.active {
      opacity: 1;
      backdrop-filter: blur(20px);
      height: auto;
    }

    &:hover {
      opacity: 0.75;
      box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    }

    .icon-wrapper {
      display: flex;
      align-items: center;
      color: var(--text-color);
      
      :global(svg) {
        color: var(--primary-color);
        stroke: var(--primary-color);
        fill: var(--tertiary-color);
      }
    }
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    position: absolute;
    right: 0;
    margin-right: 0;
    margin-left: 50%;
    left: 0;
    width: 100%;
    
  }

  .content-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h3 {
    margin: 0;
    color: var(--text-color);
    font-size: 0.9rem;
  }

  .description {
    font-size: 1rem;
    line-height: 1.5;
    
    display: flex;
    width: 44%;
    color: var(--text-color);
    position: relative;
    bottom: 0;
    height: auto;
    justify-content: center;
    align-items: center;
    margin-left: 2rem;
    text-align: justify;
    height: auto;

  }

  .video-container {
    width: 50%;
    right: 0;
    top: 0;
    position: relative;
    padding-top: 56.25%; /* 16:9 Aspect Ratio */
    overflow: hidden;
    margin: 1rem 0;
    pointer-events: auto;


    iframe {
      position: absolute;
      top: 0%;
      left: 5%;
      width: 90%;
      height: 50%;
      border-radius: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }

  

  @media (max-width: 768px) {

    .prompt-overlay {
      margin-right: 0;
      right: 0;
    }
    .prompt-grid-container {
      flex-direction: column;
      width: 100%;
      gap: 2px;
      background: transparent;

    }
    .prompt-grid-item {
      width: 100%;
    }

    .video-container {
      margin: 0.5rem 0;
    }

    .content-wrapper {
      position: relative;
      width: 100%;
      display: none;
  }
}
</style>