<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { gameService } from '$lib/stores/gameStore';
  import { currentUser } from '$lib/pocketbase';
  import { projectStore } from '$lib/stores/projectStore';
  import { get } from 'svelte/store';
  
  export let data;
  
  let isChecking = true;
  let needsInitialization = false;
  let needsHero = false;
  let needsProjectSelection = false;

    
async function checkHeroExists(userId: string, projectId: string): Promise<boolean> {
  const url = `/api/game/hero/${userId}?project=${projectId}`;
  console.log(`[DEBUG] Checking hero at: ${url}`);
  console.log(`[DEBUG] userId: "${userId}", projectId: "${projectId}"`);
  
  try {
    const response = await fetch(url);
    console.log(`[DEBUG] Response status: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.log(`[DEBUG] Fetch error:`, error);
    return false;
  }
}
  
async function checkGameMapsExist(projectId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/game/maps?project=${projectId}`);
      const data = await response.json();
      return data.maps && data.maps.length > 0;
    } catch {
      return false;
    }
  }
 async function createHero() {
    isChecking = true;
    try {
      const user = get(currentUser);
      if (!user || !currentProject) return;
      
      await gameService.getOrCreateHero(user.id, currentProject.id);
      needsHero = false;
      goto('/game/navigator');
    } catch (error) {
      console.error('Failed to create hero:', error);
    }
    isChecking = false;
  }
  
 async function initializeGameWorld() {
    if (!currentProject) return;
    
    isChecking = true;
    try {
      // Initialize game world
      await fetch('/api/game/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProject.id })
      });
      
      // After world creation, create hero
      const user = get(currentUser);
      if (user) {
        await gameService.getOrCreateHero(user.id, currentProject.id);
      }
      
      goto('/game/navigator');
    } catch (error) {
      console.error('Failed to initialize game world:', error);
      isChecking = false;
    }
  }

  async function checkGameStatus() {
    const user = get(currentUser);
    
    if (!user) {
      console.error('User not found despite authentication');
      return;
    }
    
    if (!currentProject && !projectId) {
      needsProjectSelection = true;
      isChecking = false;
      return;
    }
    
    needsProjectSelection = false;
    isChecking = true;
    
    // Check game world FIRST
    if (currentProject?.id || projectId) {
      const actualProjectId = currentProject?.id || projectId!;
      const hasGameMaps = await checkGameMapsExist(actualProjectId);
      
      if (!hasGameMaps) {
        needsInitialization = true;
        isChecking = false;
        return;
      }
    }
    
    needsInitialization = false;
    
const actualProjectId = currentProject?.id || projectId!;
const hasHero = await checkHeroExists(user.id, actualProjectId); if (!hasHero) {
      needsHero = true;
      isChecking = false;
      return;
    }
    
    // If both exist, go to navigator
    goto('/game/navigator');
    isChecking = false;
  }
  
  // Reactive stores
  $: currentProject = $projectStore.currentProject;
  $: projectId = $projectStore.currentProjectId;
  $: if (!currentProject && !projectId) {
    needsInitialization = false;
    needsHero = false;
    isChecking = true;
    checkGameStatus();
  }
    
  // Watch for project changes
  $: if (currentProject || projectId) {
    checkGameStatus();
  }

  onMount(async () => {
    checkGameStatus();
  });
</script>

<div class="game-wrapper">
  {#if isChecking}
    <div class="game-redirect">
      <p>Checking game world...</p>
    </div>
  {:else if needsProjectSelection}
    <div class="project-selection-screen">
      <h2>Please select a project to access the game world.</h2>
      <!-- <button on:click={() => goto('/')}>Go to Projects</button> -->
    </div>
  {:else if needsHero}
    <div class="hero-creation-screen">
      <h2>Create Your Hero</h2>
      <p>You need a hero to enter the game world.</p>
      <button on:click={createHero}>Create Hero</button>
    </div>
  {:else if needsInitialization}
    <div class="initialization-screen">
      <h2>Initialize Game World</h2>
      <p>No game world exists for project "{currentProject?.name}". Create one?</p>
      <button on:click={initializeGameWorld}>Create Game World</button>
    </div>
  {/if}
</div>

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		//   font-family: 'Source Code Pro', monospace;
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}



  .game-redirect, .hero-creation-screen, .initialization-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
  }
  
  button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
  }
  
  button:hover {
    background: var(--tertiary-color);
  }
</style>