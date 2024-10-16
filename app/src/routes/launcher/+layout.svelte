<slot></slot>
<!-- <script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, afterUpdate } from 'svelte';
  import { get } from 'svelte/store';
  import { elasticOut, elasticIn } from 'svelte/easing';
  import { showLoading, hideLoading } from '$lib/stores/loadingStore';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
  import { fade, slide, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { X, Bot, Wrench, Workflow, Target, Settings2, ArrowLeft, Plus, Menu, SquareMenu, List, Box, Trash2, Check, LayoutGrid } from 'lucide-svelte';
  import WorkshopOverlay from '$lib/components/overlays/WorkshopOverlay.svelte';
  import AgentsConfig from '$lib/components/overlays/AgentsConfig.svelte';
  import ModelsConfig from '$lib/components/overlays/ModelsConfig.svelte';
  import ActionsConfig from '$lib/components/overlays/ActionsConfig.svelte';
  import FlowsConfig from '$lib/components/overlays/FlowsConfig.svelte';
  import ObjectivesConfig from '$lib/components/overlays/ObjectivesConfig.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { agentStore } from '$lib/stores/agentStore';
  import { workshopStore } from '$lib/stores/workshopStore';
  import CursorEffect from '$lib/components/canvas/CursorEffect.svelte';
  import GenericOverlay from '$lib/components/overlays/GenericOverlay.svelte';
  import type { Workspaces, Workshops } from '$lib/types';
  import { getWorkshops, createWorkshop, deleteWorkshop, updateWorkshop } from '$lib/workshopClient';
  import { pb } from '$lib/pocketbase';

  import Builder from '$lib/components/ui/Builder.svelte';
  import DefaultAvatar from '$lib/components/ui//DefaultAvatar.svelte';

  import Space from '$lib/assets/icons/launcher/space.svg';
  import Add from '$lib/assets/icons/launcher/add.svg';
  import { createWorkspace, getWorkspaces, deleteWorkspace, updateWorkspace } from '$lib/workspaceClient';
  import { currentUser } from '$lib/pocketbase';
  import Chatlinks from '$lib/assets/icons/ai/chatlinks.svg';
  import { Chat } from 'openai/resources/index.mjs';
  import { quotes } from '$lib/quotes';
  import WorkspaceCreator from '$lib/components/ui/WorkspaceCreator.svelte';
  import itImage from '$lib/assets/illustrations/italian.jpeg';

  let showOverlay = false;
  let overlayContent = '';
  let touchStartY = 0;
  let currentWorkspace: Workspaces | null = null;
  let currentWorkspaceId: string | null = null;
  let workshopCount = 0;
  let isNavExpanded = false;
  let innerWidth: number;
  let showGenericOverlay = false;
  let genericOverlayContent = '';
  let workspaces: Workspaces[] = [];
  let currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
  let isScrolling = false;
  let startX: number;
  let scrollLeft: number;
  let showWorkspaceList = false;
  let editingWorkspace: string | null = null;
  let editedName: string = '';
  let confirmationMessage: string | null = null;
  let textareaElement: HTMLTextAreaElement | null = null;
  let showBuilder = false;
  let isLoading = false;
  let showFade = false;
  let showH2 = false;

  $: user = $currentUser;

  $: isNarrowScreen = innerWidth <= 700;

  $: {
    const workspaceId = $page.params.workspaceId;
    workspaceStore.subscribe(state => {
      currentWorkspace = state.workspaces.find((w: Workspaces) => w.id === workspaceId) || null;
    });

    workshopStore.subscribe(workshops => {
      workshopCount = workshops.filter(w => w.workspace === workspaceId).length;
    });
  }

  $: if ($page.params.workspaceId !== currentWorkspaceId) {
    currentWorkspaceId = $page.params.workspaceId;
    if (currentWorkspaceId && $currentUser && $currentUser.id) {
      agentStore.loadAgents(currentWorkspaceId);
    }
  }
  onMount(() => {
        user = $currentUser;
        setTimeout(() => showFade = true, 50);
        setTimeout(() => showH2 = true, 50);
    });

  onMount(async () => {
    if ($currentUser && $currentUser.id) {
      try {
        const workspaceId = $page.params.workspaceId;
        
        workspaceStore.subscribe(state => {
          workspaces = state.workspaces;
          currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
        });
        
        await workspaceStore.loadWorkspaces($currentUser.id);
        if (workspaceId) {
          await agentStore.loadAgents(workspaceId);
        }
      } catch (error) {
        console.error('Error fetching workspaces:', error);
      }
    }

    if (textareaElement) {
      const adjustTextareaHeight = () => {
        if (textareaElement) {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 300)}px`;
        }
      };

      textareaElement.addEventListener('input', adjustTextareaHeight);
      adjustTextareaHeight();
    }
  });

  afterUpdate(() => {
    if ($page.params.workspaceId) {
      workspaceStore.setCurrentWorkspace($page.params.workspaceId);
    }
  });

  async function selectWorkspace(workspaceId: string) {
  isLoading = true;
  try {
    await goto(`/launcher/workspace/${workspaceId}`);
    workspaceStore.setCurrentWorkspace(workspaceId);
    if ($currentUser && $currentUser.id) {
      await agentStore.loadAgents(workspaceId);
    }
  } catch (error) {
    console.error('Error selecting workspace:', error);
  } finally {
    isLoading = false;
  }
}
  function toggleBuilder() {
    showBuilder = !showBuilder;
  }

  async function addNewWorkspace() {
    if ($currentUser && $currentUser.id) {
      const newWorkspace: Partial<Workspaces> = {
        name: `New Workspace ${workspaces.length + 1}`,
        description: 'A new workspace',
        created_by: $currentUser.id,
        collaborators: [$currentUser.id],
      };

      try {
        const createdWorkspace = await createWorkspace(newWorkspace);
        workspaceStore.addWorkspace(createdWorkspace);
        showConfirmation('New workspace created successfully');
      } catch (error) {
        console.error('Error creating new workspace:', error);
        showConfirmation('Error creating new workspace', true);
      }
    }
  }


  function handleMouseDown(e: MouseEvent) {
    isScrolling = true;
    startX = e.pageX - (e.currentTarget as HTMLElement).offsetLeft;
    scrollLeft = (e.currentTarget as HTMLElement).scrollLeft;
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }

  function handleMouseLeave(e: MouseEvent) {
    isScrolling = false;
    (e.currentTarget as HTMLElement).style.cursor = 'grab';
  }

  function handleMouseUp(e: MouseEvent) {
    isScrolling = false;
    (e.currentTarget as HTMLElement).style.cursor = 'grab';
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isScrolling) return;
    e.preventDefault();
    const x = e.pageX - (e.currentTarget as HTMLElement).offsetLeft;
    const walk = (x - startX) * 2;
    (e.currentTarget as HTMLElement).scrollLeft = scrollLeft - walk;
  }

  function toggleWorkspaceList() {
    showWorkspaceList = !showWorkspaceList;
  }

  function closeWorkspaceList(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      showWorkspaceList = false;
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    if (confirm('Are you sure you want to delete this workspace?')) {
      try {
        await deleteWorkspace(workspaceId);
        workspaceStore.removeWorkspace(workspaceId);
        showConfirmation('Workspace deleted successfully');
      } catch (error) {
        console.error('Error deleting workspace:', error);
        showConfirmation('Error deleting workspace', true);
      }
    }
  }

  function startEditingWorkspace(workspace: Workspaces) {
    editingWorkspace = workspace.id;
    editedName = workspace.name;
  }

  async function saveEditedWorkspace(workspace: Workspaces) {
    if (editedName.trim() !== '' && editedName !== workspace.name) {
      try {
        const updatedWorkspace = await updateWorkspace(workspace.id, { name: editedName });
        workspaceStore.updateWorkspace(updatedWorkspace);
        showConfirmation('Workspace name updated successfully');
      } catch (error) {
        console.error('Error updating workspace name:', error);
        showConfirmation('Error updating workspace name', true);
      }
    }
    editingWorkspace = null;
  }

  function showConfirmation(message: string, isError: boolean = false) {
    confirmationMessage = message;
    setTimeout(() => {
      confirmationMessage = null;
    }, 3000);
  }

  function toggleOverlay(content: string) {
    if (overlayContent === content && showOverlay) {
      closeOverlay();
    } else {
      overlayContent = content;
      showOverlay = true;
    }
  }

  function closeOverlay() {
    showOverlay = false;
    overlayContent = '';
  }

  function handleTouchStart(event: TouchEvent) {
    touchStartY = event.touches[0].clientY;
  }

  function handleTouchMove(event: TouchEvent) {
    const touchEndY = event.touches[0].clientY;
    const deltaY = touchEndY - touchStartY;
    if (deltaY > 50) {
      closeOverlay();
    }
  }

  function goBack() {
    goto('/launcher/');
  }

  async function createNewWorkshop() {
        if (currentWorkspace) {
            try {
                const newWorkshop: Partial<Workshops> = {
                    name: `New Workshop ${workshops.length + 1}`,
                    description: 'A new workshop',
                    workspace: currentWorkspace.id,
                    workflow: '',
                    prompt: '',
                    replies: [],
                };
                const createdWorkshop = await createWorkshop(newWorkshop);
                workshopStore.addWorkshop(createdWorkshop);
                workshops = [...workshops, createdWorkshop];
            } catch (error) {
                console.error('Error creating new workshop:', error);
            }
        }
    }

  function toggleNav() {
    isNavExpanded = !isNavExpanded;
  }

  function closeGenericOverlay() {
    showGenericOverlay = false;
    genericOverlayContent = '';
  }

  function getAvatarUrl(workspace: Workspaces): string | null {
    if (workspace.avatar) {
      return pb.getFileUrl(workspace, workspace.avatar);
    }
    return null;
  }
</script>

<svelte:window bind:innerWidth />
{#if showH2}

<div class="layout" in:fly="{{ y: -400, duration: 400 }}" out:fade="{{ duration: 300 }}">
  <img src={itImage} alt="Italian illustration" class="illustration" />

  {#if isLoading}
    <div class="loading-overlay">
      <LoadingSpinner />
    </div>
  {/if}

  <div class="workspace-container">
    <div class="workspace-selector"
      on:mousedown={handleMouseDown}
      on:mouseleave={handleMouseLeave}
      on:mouseup={handleMouseUp}
      on:mousemove={handleMouseMove}
      style="cursor: grab;">        
      {#each workspaces as workspace (workspace.id)}
        <button class="workspace-button" on:click={() => selectWorkspace(workspace.id)}>
          {#if getAvatarUrl(workspace)}
            <img src={getAvatarUrl(workspace)} alt={workspace.name} class="workspace-avatar" />
          {:else}
            <DefaultAvatar name={workspace.name} size={40} />
          {/if}
          <span>{workspace.name}</span>
        </button>
      {/each}
    </div>
    {#if currentWorkspace}
      <div class="workspace-name">{currentWorkspace.name}</div>
    {/if}
  </div>

  <nav class="config-selector" class:collapsed={!isNavExpanded && isNarrowScreen}>
    {#if isNarrowScreen}
      <button class="toggle-nav" on:click={toggleNav}>
        <SquareMenu size={24} class="nav-icon" />
      </button>
    {/if}

    <button 
      class={overlayContent === 'Agents' ? 'active' : ''}
      on:click={() => toggleOverlay('Agents')}
    >
      <Bot size={24} class="nav-icon" />
    </button>
    <button 
      class={overlayContent === 'Models' ? 'active' : ''}
      on:click={() => toggleOverlay('Models')}
    >      
      <Settings2 size={24} class="nav-icon" />
    </button>
    <button 
      class={overlayContent === 'Actions' ? 'active' : ''}
      on:click={() => toggleOverlay('Actions')}
    >
      <Wrench size={24} class="nav-icon" />
    </button>
    <button 
      class={overlayContent === 'Flows' ? 'active' : ''}
      on:click={() => toggleOverlay('Flows')}
    >
      <Workflow size={24} class="nav-icon" />
    </button>
    <button 
      class={overlayContent === 'Objectives' ? 'active' : ''}
      on:click={() => toggleOverlay('Objectives')}
    >
      <Target size={24} class="nav-icon" />
    </button>
  </nav>

  <CursorEffect />

  <main>
    <slot />
  </main>

  {#if showOverlay}
    <div
      class="overlay"
      on:click={closeOverlay}
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      transition:fade={{ duration: 200 }}
    >
      <div 
        class="overlay-content" 
        on:click|stopPropagation
        transition:slide={{ duration: 200 }}
      >
        <button class="close-button" on:click={closeOverlay} transition:fade={{ duration: 300 }}>
          <X size={30} />
        </button>
        
        {#key overlayContent}
          <div in:fly={{ x: -50, duration: 300, delay: 300 }} out:fly={{ x: 50, duration: 300 }}>
            {#if overlayContent === 'Agents'}
              <AgentsConfig />
            {:else if overlayContent === 'Models'}
              <ModelsConfig />
            {:else if overlayContent === 'Actions'}
              <ActionsConfig />
            {:else if overlayContent === 'Flows'}
              <FlowsConfig />
            {:else if overlayContent === 'Objectives'}
              <ObjectivesConfig />
            {/if}
          </div>
        {/key}
      </div>
    </div>
  {/if} 

  {#if showWorkspaceList}
    <div class="overlay" on:click={closeWorkspaceList} transition:slide="{{ duration: 300, easing: quintOut }}">
      <div class="overlay-handle">
        <h1>Workspaces</h1>
        <button class="menu-button" on:click={closeWorkspaceList}>
          <X size={40} />
        </button>
      </div>
      <div class="lists-container">
        <div class="workspace-list">
          {#each workspaces as workspace (workspace.id)}
            <div class="workspace-list-item">
              {#if editingWorkspace === workspace.id}
                <input
                  type="text"
                  bind:value={editedName}
                  on:keydown={(e) => e.key === 'Enter' && saveEditedWorkspace(workspace)}
                  on:blur={() => saveEditedWorkspace(workspace)}
                />
                <button class="check-button" on:click={() => saveEditedWorkspace(workspace)}>
                  <Check size={30} />
                </button>
              {:else}
                <Box size={30} /> 
                <p on:click={() => startEditingWorkspace(workspace)}>
                  {workspace.name}
                </p>
                <div class="spacer">
                  <button class="icon-button" on:click={() => handleDeleteWorkspace(workspace.id)}>
                    <Trash2 size={30} />
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="workspace-list">
          <button class="workspace-list-item" on:click={addNewWorkspace}>
            <Plus size={30} /> 
            <p>
              Add New Workspace Group
            </p>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
{/if}

{#if showGenericOverlay}
  <GenericOverlay 
    on:close={closeGenericOverlay}
    title={genericOverlayContent}
  >
    <Builder/>
    <p>This is the content for {genericOverlayContent}</p>
  </GenericOverlay>
{/if}

<style>

  .layout {
    position: absolute;

justify-content: center;
align-items: center;
margin-left: auto;
margin-right: auto;
/* margin: 1rem; */
width: 96%;
top: 60px;

right: 2%;
/* max-width: 1200px; */
/* margin-top: 80px; */
height: 90vh;
display: flex;
flex-direction: column;
overflow: hidden;
background-color:#010e0e;
border-radius: 40px;
}
 
  main {
    flex-grow: 1;
    overflow-y: auto;
    /* margin-left: 50px; */
    padding: 20px;
  }

  .workspace-container {
  display: flex;
  align-items: center;
  width: 100%;
}

.workspace-selector:hover + .workspace-name {
  opacity: 0;
}

  .config-selector {
    display: flex;
    flex-direction: row;
    position: absolute;
    left:20px;
    top: 80px;
    /* margin-left: 20px; */
    padding: 20px 10px;
    /* position: absolute; */
    justify-content: space-between;
    align-items: center;
    /* bottom: 80px; */
    /* height: 60px; */
    /* left: 80px; */
    /* gap: 20px; */
    /* padding: 5px; */
    /* border-radius: 20px; */
    z-index: 1002;
    width: 400px;
    border-radius: 20px;

    /* background-color: rgb(58, 50, 50); */
    background-color: #262929;
    /* width: 300px; */
    transition: all 0.3s ease;  /* Added transition for smooth toggle */
  }

  .config-selector.expanded {
    width: 80%;
  }

  .config-selector button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    /* width: 100%; */
    font-size: 20px;
    border: none;
    background-color: transparent;
    color: rgb(133, 133, 133);
    /* border: 1px solid rgb(58, 58, 58); */

    cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    /* background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%); */

  }


  .config-selector button.active {
    color: white;
    transform: scale(1.5);
  }


  .toggle-nav {
    display: none;
  }

  .overlay {
    position: fixed;
    /* top: 0px; */
    /* left: 50px; */
    /* right: 1%; */
    /* bottom: 200px; */
    /* height: 85vh; */
    /* background: linear-gradient(
      to bottom, 
      rgba(54, 63, 63, 0.1),
      rgba(54, 63, 63, 0)
    ); */
    backdrop-filter: blur(10px);
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    overflow: hidden;
        /* padding: 20px; */
        width: 98%;
        left: 1%;
        border-radius: 20px;
        /* height: 87vh; */


  }

  .overlay-content {
    /* background-color: rgba(255, 255, 255, 0.1); */
    backdrop-filter: blur(10px);
    /* padding: 20px; */
    border-top-right-radius: 10px;
    border-bottom-right-radius: 10px;
    height:80%;
    width: 96%;
    overflow: hidden;
    position: absolute;
    left: 70px;
    top: 300px;
  }

  .close-button {
    position: absolute;
    top: 0;
    right: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: white;
  }

  .footer {
    position: fixed;
    bottom: 80px;
    /* left: 50px; */
    right: 0;
    height: auto;
    /* background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    width: 100%;
    /* background-color: #363f3f; */
  }




    /* .workspace-button {
    width: 400px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
  } */

  .workshop-count {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    text-align: center;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: bold;
  }

  .menu-button {
    /* width: 60px; */
    /* height: 60px; */
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      background-color: red;

  }

  .workspace-button:hover {
    background-color: #5a5a58;
    transform: scale(1.05);
  }

  .menu-button:hover {
    background-color: #5a5a58;
    transform: scale(1.45);
  }

  .config-selector button:hover {
    /* background-color: #5a5a58; */
    transform: scale(1.45);
    color: white;
  }

  .config-selector button.active {
    color: white;
    transform: scale(1.5);
  }


  span {
    /* width: 80%; */
    text-align: center;
  }

  .nav-icon {
  width: 40px;
  height: 40px;
}
.workspace-selector {
  display: flex;
  flex-direction: row;
  position: relative;
  align-items: center;
  justify-content: flex-start;
  /* border-right: 1px solid black; */
  left: 20px;
  top: 20px;
  /* border-radius: 20px; */
  /* padding: 10px; */
  /* height: 100%; */
 /* overflow-y: hide; */
  overflow-x: scroll; 

  height: 60px;
  width: 600px;
  user-select: none;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  transition: all 0.3s ease;
}

.workspace-selector:hover {
  width: 90%;
  overflow-x: scroll;
  overflow-y: hidden;

  z-index: 10000;
  overflow-y: hide;
  /* background-color: rgb(37, 37, 37); */

}

.workspace-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: transparent;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  text-align: center;
  font-size: 10px;
  /* margin-left: 5px; */
  transition: all 0.3s ease;
  scroll-snap-align: start;
}

.workspace-selector:hover .workspace-button {
  width: 90%;
  /* height: 60px; */
  border-radius: 50px;
  flex-direction: row;
  justify-content: flex-start;
  gap: 10px;
  /* font-size: 18px; */
  text-align: left;
  /* border-bottom: 1px solid white; */

}

.workspace-avatar,
:global(.default-avatar) {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.workspace-selector:hover .workspace-avatar,
.workspace-selector:hover :global(.default-avatar) {
  width: 40px;
  height: 40px;
  margin-left: 10px;
}

.workspace-button span {
  display: none;
  font-size: 8px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.3s ease;
  font-family: 'Lora', serif;
}

.workspace-selector:hover .workspace-button span {
  display: inline;
  font-size: 18px;
}

.workspace-handle {
display: none;
  width: 300px;
  height: 50px;
  padding: 5px;
  background-color: #262929;
  color: white;
  font-weight: bolder;
  text-transform: uppercase;
  transition: left 0.3s ease;
  /* display: flex; */
  font-size: 16px;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 60px;
  left: 110px;
  border-radius: 8px;
  border: 2px solid rgb(56, 56, 56);
  /* border-right: 1px solid black; */
}

.workspace-selector:hover ~ .workspace-handle {
  left: 200px;
}
  .workspace-avatar,
  :global(.default-avatar) {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .workspace-button:hover {
    background-color: #f0f0f0;
    transform: scale(1.05); 
  }

  .workspace-menu {
    display: flex;
    position: fixed;
    margin: 0 auto;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    overflow-x: hidden;
    overflow-y: hidden;
    width: 200px;
    top: 0;
    margin-left: 2%;
    height: 80px;
    margin-bottom: 10px;
  }

  .menu-button {
    padding: 10px 20px;
    border: none;
    border-radius: 20px;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 20%);
    color: #838383;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60px;
    width: 60px;
    gap: 5px;
    text-align: center;
    font-size: 24px;
    transition: background 0.3s, transform 0.3s;
  }

  .menu-button:hover {
    background-color: #f0f0f0;
    transform: background 0.3s, transform 0.3s; 
    color: #3278a6;
  }


  .overlay {
    position: fixed;
    bottom: 80px;
    left: 0;
    right: 0;
    height: 100vh;
    background: linear-gradient (
        90deg,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(0, 0, 0, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(0, 0, 0, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(0, 0, 0, 0.55) 35%,
        rgba(0, 0, 0, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(0, 0, 0, 0.4) 50%,
        rgba(0, 0, 0, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(0, 0, 0, 0.1) 80%,
        rgba(1, 1, 1, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
      );
      backdrop-filter: blur(10px);

        /* opacity: 0.8; */
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    /* z-index: 2000; */
    /* gap: 40px; */

  }

  .overlay-handle {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    height: 80px;
    /* background-color: #1c1b1d; */
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
  }

  .lists-container {
    display: flex;
    flex-direction: column;
    /* gap: 20px; */
    /* padding: 20px; */
    background-color: #1c1b1d;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 90%);
    width: 100%;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
    
  }

  .workspace-list {
    background-color: #1c1b1d;
    /* border-top-left-radius: 20px; */
    /* border-top-right-radius: 20px; */
    /* padding: 20px; */
    max-height: calc(80vh - 40px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    /* height: auto; */
    border-radius: 20px;
    /* width: 96%; */
    /* justify-content: center; */
    /* align-items: center; */
    /* margin-left: 2%; */
    gap: 4px;
    margin-bottom: 20px;
    overflow: hidden;

  }

  .workspace-list-item {
    display: flex;
    flex-direction: row;
    width: 100%;
    /* margin-left: 3%; */
    padding: 10px;
    background: linear-gradient(to top, #1a1a1a, #212121);
    align-items: center;
    gap: 10px;
    color: white;
    border: none;
    /* border-radius: 10px; */
    text-align: left;
    font-size: 20px;
    cursor: pointer;
    transition: background 0.3s;
    user-select: none;
  }

  .workspace-list-item:hover {
    background: #5a5a58;
  }



.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .illustration {
  position: absolute;
  width: 95%;
  height: auto;
  left: 5%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.025;
  z-index: 1;
  pointer-events: none;
}

.workspace-name {
  margin-left: 20px;
  font-size: 18px;
  opacity: 1;
  transition: opacity 0.3s ease;
}
  @media (max-width: 700px) {
    .config-selector {
      width: auto;
      left: 0;
      /* padding: 1px 5px; */
      /* gap: 0.25rem; */
      /* bottom: 5px; */
      /* background-color: transparent; */



      
    }

    .config-selector.expanded {
      width: 80%;
      flex-wrap: wrap;
      justify-content: flex-start;

      
    }

    .config-selector:not(.expanded) {
      width: 60px;
      height: 60px;
      /* bottom: 24px; */
      /* left: 40px; */
    }

    .config-selector button{
    /* padding: 0px; */
    /* scale: 0.5; */
  }

  .menu-button button{
    scale: 0.5;
  }




    .config-selector.collapsed {
      width: 380px;
      height: 60px;
      display: flex;
      position: fixed;
      gap: 10px;
      bottom: 0;
      left: 0;
      align-items: center;
      justify-content: center;
      /* background-color: blue; */

    }

    .config-selector:not(.expanded) button:not(.toggle-nav) {
      display: none;
    }



    .config-selector.expanded button {
      display: flex;
      
    }


    .toggle-nav {
      display: flex;
      position: absolute;
      left: 1rem;      
      bottom: 1rem;
      /* width: 80px; */
    }

    .config-selector button:not(.toggle-nav) {
      display: none;
    }

    .config-selector.collapsed button:not(.toggle-nav) {
      display: flex;
      /* background-color: rgb(58, 50, 50); */
      
      
    }


    .nav-icon {
    width: 20px;
    height: 20px;
  }





  .workspace-selector:hover .workspace-avatar,
  .workspace-selector:hover :global(.default-avatar) {
    width: 30px;
    height: 30px;
  }


  .workspace-handle,
  .workspace-selector:hover ~ .workspace-handle {
    left: 80px;
  }

    .workspace-avatar,
    :global(.default-avatar) {
      width: 30px;
      height: 30px;
    }

    .workspace-button span {
      display: none;
      font-size: 8px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

  .menu-button {
    transform: scale(0.7); /* Adjust scale as needed */
  }

  .menu-button .nav-icon {
    width: 20px;
    height: 20px;
  }

  
  .workshop-count {
    width: 30px;
    height: 30px;
    font-size: 16px;
  }



  }
</style> -->