<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { workspaceStore } from '$lib/stores/workspaceStore';
    import { workshopStore } from '$lib/stores/workshopStore';
    import { getWorkshops, createWorkshop, deleteWorkshop, updateWorkshop } from '$lib/workshopClient';
    import type { Workspaces, Workshops } from '$lib/types';
    import { wormhole } from '$lib/transitions/wormhole';
    import { Hammer, Edit2, Trash2 } from 'lucide-svelte';
    import WorkshopOverlay from '$lib/components/overlays/WorkshopOverlay.svelte';
    import { currentUser } from '$lib/pocketbase';
    import { isLoading, showLoading, hideLoading } from '$lib/stores/loadingStore';
    import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
  
  let currentWorkspace: Workspaces | null = null;
    let workshops: Workshops[] = [];
    let isTransitioningBack = false;
    let selectedWorkshop: Workshops | null = null;
    let isEditing: { [key: string]: boolean } = {};
    let error: string | null = null;
    let loading = true;  // Add this line
    let workshopCount = 0;

    $: {
  const workspaceId = $page.params.workspaceId;
  workspaceStore.subscribe(state => {
    currentWorkspace = state.workspaces.find((w: Workspaces) => w.id === workspaceId) || null;
  });

  workshopStore.subscribe(workshops => {
    workshopCount = workshops.filter(w => w.workspace === workspaceId).length;
  });
}



  async function fetchWorkshops(workspaceId: string): Promise<Workshops[]> {
      try {
          const fetchedWorkshops = await getWorkshops(workspaceId);
          return fetchedWorkshops;
      } catch (error) {
          console.error('Error fetching workshops:', error);
          throw error;
      }
  }

  async function handleDeleteWorkshop(workshopId: string) {
      try {
          await deleteWorkshop(workshopId);
          workshopStore.removeWorkshop(workshopId);
          workshops = workshops.filter(w => w.id !== workshopId);
      } catch (error) {
          console.error('Error deleting workshop:', error);
      }
  }

  function startEditing(workshopId: string) {
      isEditing = { ...isEditing, [workshopId]: true };
  }

  async function finishEditing(workshop: Workshops, event: Event) {
      const input = event.target as HTMLInputElement;
      const newName = input.value.trim();
      if (newName && newName !== workshop.name) {
          try {
              const updatedWorkshop = await updateWorkshop(workshop.id, { name: newName });
              workshopStore.updateWorkshop(updatedWorkshop);
              workshops = workshops.map(w => w.id === updatedWorkshop.id ? updatedWorkshop : w);
          } catch (error) {
              console.error('Error updating workshop name:', error);
          }
      }
      isEditing = { ...isEditing, [workshop.id]: false };
  }

  function openWorkshop(workshop: Workshops) {
      selectedWorkshop = workshop;
  }

  function closeWorkshop() {
      selectedWorkshop = null;
  }
</script>

<div 
  class="workshops-container" 
  in:wormhole={{ duration: 1000 }}
  out:wormhole={{ duration: 1000 }}
  class:transitioning-back={isTransitioningBack}
>
{#if loading}

  <LoadingSpinner />
  {:else if error}

    <p class="error">{error}</p>
  {:else if currentWorkspace}
    <div class="flex-container">
      {#each workshops as workshop (workshop.id)}
        <div class="workshop-item">
          {#if isEditing[workshop.id]}
            <input
              type="text"
              value={workshop.name}
              on:blur={(e) => finishEditing(workshop, e)}
              on:keydown={(e) => e.key === 'Enter' && finishEditing(workshop, e)}
            />
          {:else}
            <div class="workshop-header">
              <Hammer size={20} />
              <h3 on:click={() => startEditing(workshop.id)}>{workshop.name}</h3>
            </div>
          {/if}
          <div class="workshop-controls">
            <button class="control-button" on:click={() => openWorkshop(workshop)}>
              <Edit2 size={20} />
            </button>
            <button class="control-button delete" on:click={() => handleDeleteWorkshop(workshop.id)}>
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p>Workspace not found</p>
  {/if}
</div>

{#if selectedWorkshop}
  <WorkshopOverlay workshop={selectedWorkshop} onClose={closeWorkshop} user={$currentUser} />
{/if}

<style>
  .workshops-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: absolute;
      top: 40px;
      left: 50px;
      right: 0;
      bottom: 100px;
      padding: 20px;
      border-radius: 20px;
      transition: all 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      overflow-y: auto;
      overflow-x: hidden;

  }


  .workshops-container.transitioning-back {
      transform: scale(0.05);
      opacity: 0;
  }

  .workshop-header {
      display: flex;
      flex-direction: row;
      gap: 10px;
      align-items: center;
      user-select: none;

  }

  .flex-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      width: 100%;
      overflow-x: hidden;

  }

  .flex-container > * {
      /* flex: 1 1 200px; */
  }


  .workshop-item {
      flex: 1 1 200px;
      border: 1px solid #ccc;
      padding: 15px;
      border-radius: 5px;
      background-color: rgb(217, 216, 216);
      position: relative;

  }



  .menu-button {
    padding: 10px 20px;
    border: none;
    border-radius: 20px;
    background-color: transparent;
    color: white;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 5px;
    text-align: center;
    font-size: 24px;
    transition: background-color 0.3s, transform 0.3s;
    
  }

  .menu-button:hover {
    background-color: #f0f0f0;
    transform: background-color 0.3s, transform 0.3s; 
  }

  
  .create-workshop  {
      padding: 10px 10px;
      background-color: #4b4b49;
      color: white;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      /* height: 50px; */
      width: 200px;
      height: 60px;
      gap: 5px;
      text-align: center;
      font-size: 18px;
      margin-left: 5px;
      transition: background-color 0.3s, transform 0.3s;
      scroll-snap-align: start;

  }


  .create-workshop.new {
      color: rgb(71, 223, 165);
  }

  .create-workshop:hover {
      background-color: #f0f0f0;
      transform: scale(1.05); 
  }

  .back-button {
      padding: 10px 10px;
      background-color: #4b4b49;
      color: white;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      /* height: 50px; */
      width: 200px;
      height: 60px;
      gap: 5px;
      text-align: center;
      font-size: 18px;
      margin-left: 5px;
      transition: background-color 0.3s, transform 0.3s;
      scroll-snap-align: start;

  }

  h1 {
      font-size: 24px;
      margin-bottom: 20px;
      position: absolute;
      bottom: 80px;
      left:calc(50% - 180px);
      padding: 10px;
      border-bottom: 2px solid #ccc;
  }

  .footer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: auto;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
    /* opacity: 0.5; */


  }

  .workspace-menu {
    display: flex;
    margin: 0 auto;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    overflow-x: hidden;
    overflow-y: hidden;
    /* scroll-behavior: smooth; */
    width: 96%;
    margin-left: 2%;
    background-color: transparent;
    height: 80px;
    
  }
  

  .workspace-button {
    padding: 10px 10px;
    background-color: #4b4b49;
    color: white;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 60px;
    gap: 5px;
    text-align: center;
    font-size: 18px;
    margin-left: 5px;
    transition: background-color 0.3s, transform 0.3s;
    scroll-snap-align: start;
  }

  .workspace-button:hover {
    background-color: #f0f0f0;
    transform: scale(1.05); 
  }
  .workspace-button.new {
      color: rgb(71, 223, 165);
  }

  .workspace-button:hover {
      background-color: #f0f0f0;
      transform: scale(1.05); 
  }

  :global(.loading-spinner) {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

</style>