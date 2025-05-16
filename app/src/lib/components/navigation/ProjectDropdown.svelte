<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';
  import { currentUser } from '$lib/pocketbase';
  import { projectStore } from '$lib/stores/projectStore';
  
  import { loadThreads, threadListVisibility } from '$lib/clients/threadsClient';
  import { fetchProjects, resetProject, fetchThreadsForProject, updateProject, removeThreadFromProject, addThreadToProject} from '$lib/clients/projectClient';
  import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus, Book, Home, Stamp, Layers2, Layers, ChevronLeft, Asterisk, PackageOpen, Package } from 'lucide-svelte';
  import type { Projects } from '$lib/types/types';
  import { onMount } from 'svelte';
  import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
  import { t } from '$lib/stores/translationStore';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  export let isOpen = false;

  let dropdownContainer: HTMLElement;
  let isExpanded = false;
  let isCreatingProject = false;
  let newProjectName = '';
  let searchQuery = '';
  let projects: Projects[] = [];
  let currentProject: Projects | null = null;
  let currentProjectId: string | null = null;
  let isEditingProjectName = false;
  let editingProjectId: string | null = null;
  let editedProjectName = '';
  let filteredProjects = $projectStore.threads;
  let currentThreadId: string | null = null;  
  let isLoading: boolean = false;

  $: console.log('Store state:', $projectStore);
  $: console.log('Filtered projects:', filteredProjects);
  $: console.log('Current project:', $projectStore.currentProject);

  async function handleSelectProject(projectId: string | null) {
  console.log('Selecting project:', projectId === null ? 'Home (unassigned)' : projectId);
  try {
    isExpanded = false;
    isLoading = true;

    // Clear current thread first
    threadsStore.update(state => ({
      ...state,
      currentThreadId: null,
      threads: [],
      filteredThreads: []
    }));

    await projectStore.setCurrentProject(projectId);
    
    console.log(`Loading ${projectId ? 'project' : 'unassigned'} threads...`);
    try {
      await loadThreads(projectId);
      
      threadsStore.update(state => {
        const threadsForProject = projectId 
          ? state.threads.filter(thread => thread.project_id === projectId)
          : state.threads.filter(thread => !thread.project_id);
          console.log(`Filtered to ${threadsForProject.length} threads for project ${projectId || 'unassigned'}`);

        return {
          ...state,
          threads: threadsForProject,
          filteredThreads: threadsForProject
        };
      });
      
      console.log('Threads loaded successfully for:', projectId ? `project ${projectId}` : 'unassigned threads');
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  } catch (error) {
    console.error("Project selection error:", error);
  } finally {
    isLoading = false;
  }
}

  async function handleCreateNewProject(nameOrEvent?: string | Event) {
    const projectName = typeof nameOrEvent === 'string' ? nameOrEvent : newProjectName;

    if (!projectName.trim()) return;

    try {
      isCreatingProject = true;
      const newProject = await projectStore.addProject({
        name: projectName.trim(),
        description: ''
      });
      
      if (newProject) {
        newProjectName = '';
        isCreatingProject = false;
        isExpanded = false;
        await handleSelectProject(newProject.id);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      isCreatingProject = false;
    }
  }

  async function handleDeleteProject(e: Event, projectId: string) {
    e.stopPropagation();
    
    if (!projectId) return;
    
    try {
      const user = get(currentUser);
      if (!user) throw new Error('User not authenticated');
      
      const storeState = get(projectStore);
      const project = storeState.threads.find(p => p.id === projectId);
      
      if (!project) {
        alert('Project not found');
        return;
      }
      
      if (project.owner !== user.id) {
        alert('Only the project owner can delete this project.');
        return;
      }
      
      const confirmed = confirm('Are you sure you want to delete this project? This action cannot be undone.');
      if (!confirmed) return;
      
      const success = await projectStore.deleteProject(projectId);
      
      if (success && $projectStore.currentProjectId === projectId) {
        await handleSelectProject(null);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
      isExpanded = false;
      isCreatingProject = false;
    }
  }

  $: filteredProjects = searchQuery 
    ? $projectStore.threads.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : $projectStore.threads;
    $: isThreadListVisible = $showThreadList;
    $: isOpen = isExpanded;

  onMount(async () => {
    try {
      await projectStore.loadProjects();
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  });

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="dropdown-container" bind:this={dropdownContainer}>
  <span class="dropdown-wrapper">


  <button 
    class="dropdown-trigger selector"
    class:drawer-visible={$showThreadList}
    class:active={isExpanded}
    on:click={() => isExpanded = !isExpanded}
    disabled={isLoading}
  >
  
    <span class="trigger-text">
      {#if $projectStore.currentProject}
          <span class="icon home" class:rotated={isExpanded} on:click|preventDefault={() => !isLoading && handleSelectProject(null)}>
            <ChevronLeft/> 
            <!-- <p>Home</p> -->
          </span>
    {/if}
      <span class="trigger-display" class:drawer-visible={$showThreadList}
      >

    {#if $projectStore.currentProject}
          <span class="active">
          <PackageOpen size={16} />

          </span>
      {:else}
        <Package size={16} />
      {/if}
      <span>
        {$projectStore.currentProject?.name || 'Projects'}
      </span>
     
      </span>    
      <!-- <span>
        <span class="separator">|</span>
        <span class="trigger-drop">
          <ChevronDown/>
        </span>
      </span>      -->

      <span class="icon" class:rotated={isExpanded}>/</span>
    </span>
  </button>
  </span>


  {#if isExpanded}
    <div class="dropdown-content" transition:slide={{ duration: 200 }}>
      <div class="dropdown-header">
        <div class="search-bar">
          <span><Search /></span>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={$t('nav.searchProjects')}
          />
        </div>
        <button 
          class="create-btn"
          on:click={() => isCreatingProject = !isCreatingProject}
          disabled={isLoading}
        >
          <Plus />
        </button>
      </div>

      {#if isCreatingProject}
        <div class="create-form" transition:slide>
          <input
            type="text"
            bind:value={newProjectName}
            placeholder="Project name..."
            on:keydown={(e) => {
              if (e.key === 'Enter' && newProjectName.trim()) {
                handleCreateNewProject();
              }
            }}
          />
          <button 
            class="create-btn"
            disabled={!newProjectName.trim() || isLoading}
            on:click={() => handleCreateNewProject(newProjectName)}
          >
            <Check size={16} />
          </button>
        </div>
      {/if}

      <div class="projects-list">
        {#if isLoading}
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        {:else}
          {#each filteredProjects as project (project.id)}
            <div 
              class="project-item"
              class:active={$projectStore.currentProjectId === project.id}
              class:disabled={isLoading}
              on:click|preventDefault={() => !isLoading && handleSelectProject(project.id)}
            >
              <span class="project-name">{project.name}</span>
              <div class="project-actions">
                <button 
                  class="action-btn delete"
                  disabled={isLoading}
                  on:click|stopPropagation={(e) => handleDeleteProject(e, project.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
  
  <style lang="scss">
	@use 'src/styles/themes.scss' as *;

    * {
      font-family: var(--font-family);

    }
    .dropdown-container {
      position: relative;
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
      align-items: flex-start;
      height: 2rem;
      width: auto;
      z-index: 4000;
      user-select: none;
      
    }
    .dropdown-wrapper {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      height: auto;


    }

    span.dropdown-trigger {
      padding: 0 !important;
      margin: 0 !important;
      height: auto;
      transition: all 0.2s ease;

    }
    .dropdown-trigger {
      background: transparent;

      border: 1px solid transparent;
      // border-bottom: 1px solid var(--placeholder-color);
      margin-top: 0;
      margin: 0;
      border-radius: 0.5rem;
      color: var(--line-color);
      cursor: pointer;
      // padding: 0.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0;
      transition: all 0.2s ease;
      height: auto;
      width: 100%;
      &.selector {
        height: auto;
        padding: 0.5rem;
        height: 2rem;
        width: auto;
        flex: 0;
        // box-shadow: 1px 2px 5px 2px rgba(255, 255, 255, 0.1);
        &.active {
          display: none;
        }

      }
      &.home {
        display: flex;
        justify-content: center;
        width: auto;
        padding: 0.5rem !important;
        background: transparent !important;
        border: 1px solid transparent;

      }

      & span.icon {
        display: none;
        }
      & span.icon.home {
        display: flex;
        flex-direction: row;
        font-size: 0.9rem;
        margin: 0;
        padding: 0;
        letter-spacing: 0;
        color: var(--tertiary-color);
        gap: 0;
        & p {
          margin: 0;
        }
      }

    }
    span.trigger-text {
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: space-between;
      align-items: center;
      
      
    }
    .trigger-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-end;
      height: 100%;
      gap: 0;
      color: var(--placeholder-color);
      letter-spacing: 0.1rem;

      .icon {
        transition: transform 0.2s ease;
        
        &.rotated {
          // transform: scale(1.5);
        }
      }
    }
    .drawer-visible.dropdown-trigger {
      // width: calc(400px - 2rem);
      & span.trigger-display {
        font-size: 1rem !important;
        padding: 0.5rem;
        color: var(--text-color);
        transition: 0.2s ease all;
        & span {
          display: none;
          transition: 0.2s ease all;
        }
        &:hover {
          padding: 1rem;

          & span {
            display: flex;
          }
        }

      }
    }

      span.trigger-display {
        font-size: 0.8rem !important;
        padding: 0.5rem;
        color: var(--text-color);
        gap: 0.5rem;
        transition: 0.2s ease all;
        border-radius: 1rem;
        height: 2rem;
          span.active {
            display: flex !important;
            color: var(--tertiary-color);
          }
        & span {
          display: none;
          transition: 0.2s ease all;

        }
        &:hover {
          padding: 0 0.5rem !important;
          background: var(--primary-color);

          & span {
            display: flex;
          }
        }

      }
    span.trigger-icon {
      display: none;
      color: var(--line-color);
    }
    span.separator {
      color: var(--line-color);
    }
    span.trigger-drop {
      display: flex;
      color: var(--line-color);
      transition: all 0.2s ease;

      &:hover {
        color: var(--tertiary-color);
      }
    }
    .dropdown-content {
      border-radius: 0.5rem;
      border: 1px solid var(--line-color);
      
      padding-top: 0;
      top: auto !important;
      display: flex;
      flex-direction: column;
      margin-top: 0;
      align-items: center;
      position: relative;
      width: 100%;
      background-color: var(--secondary-color);
      height: auto;
      // box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);

    }
  
    .dropdown-header {
      display: flex;
      align-items: center;
      height: 2rem;
      margin: 0;
      border-radius: 2rem;
      width: calc(100%);
      gap: 0;
      backdrop-filter: blur(10px);
      
      // border: 1px solid var(--secondary-color);
      // border-bottom: 1px solid var(--secondary-color);
      // border-radius: 2rem;
      
    }
  
    .search-bar {
      display: flex;
      gap: 0.5rem;
      margin-left: 0;
      margin-right: 0.5rem;
      // border-radius: var(--radius-l);

      flex: 1;
      padding-inline-start: 0.5rem;
      color: var(--text-color);
      // background: var(--primary-color);
      width: 100%;
      input {
        border: none;
        color: var(--text-color);
        background: transparent;
        outline: none;
        line-height: 1;
        height: auto;
        padding: 0;
        justify-content: center;
        text-align: left;
        font-size: 1.2rem;
        transition: all 0.3s ease;
        width: auto;

        &:focus {

        }
        &::placeholder {
          color: var(--placeholder-color);
        }
      }
    }
  
    .create-btn {
      background: transparent;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      padding: 0;
      border-radius:50%;
      width: auto;
      height: auto;
      margin-right: 0.5rem;

  
      &:hover {
        background: var(--secondary-color);
        color: var(--tertiary-color);
      }
    }
  
    .create-form {
        display: flex;
      gap: 0.5rem;
      width: 100%;
  
      input {
        flex: 1;
        font-size: 1.5rem;
        width: auto;
        // padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.5rem;
        background: var(--bg-color);
        color: var(--text-color);
      }
  
      .confirm-btn {
        background: transparent;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.5rem;
  
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
  
        &:not(:disabled):hover {
          background: var(--secondary-color);
          color: var(--tertiary-color);
        }
      }
    }

    span {
        display: flex;
        justify-content: center;
        align-items: center;
    }
  
    .projects-list {
      height: auto;
      
      width: 600px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      // border: 1px solid var(--secondary-color);
      margin-right: 0;
      margin-left: 0;
     padding: 0.5rem;
      background: var(--secondary-color);
      border-bottom-left-radius: var(--radius-m);
      border-bottom-right-radius: var(--radius-m);
      overflow-y: auto;
      scrollbar-color: var(--secondary-color) transparent;
      backdrop-filter: blur(20px);
      // box-shadow: 0 50px 100px 4px rgba(255, 255, 255, 0.2);

    }
  
    .project-item {
      padding: 1rem;
      display: flex;
      align-items: center;
      // box-shadow: 0 50px 100px 4px rgba(255, 255, 255, 0.2);
      color: var(--placeholder-color);
      justify-content: space-between;

      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 0.4rem;
      &:hover {
        background: var(--secondary-color);
  
        .project-actions {
          opacity: 1;
        }
      }
  
      &.active {
        // background: var(--bg-color);
        color: var(--text-color);
        font-weight: 800;
      }
    }
  
    .project-name {
      font-size: 1.1rem;
      letter-spacing: 0.5rem;
    }
  
    .project-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  
    .action-btn {
      background: transparent;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.5rem;
  
      &:hover {
        background: var(--secondary-color);
        
        &.delete {
          color: red;
        }
      }
    }

    .icon.home {
      border-radius: 50%;
      transition: all 0.2s ease;
      &:hover {
        background: var(--primary-color);
        padding: 0.25rem !important;

      }
    }
    @media (max-width: 1000px) {

    .projects-list {
      height: auto;
      width: 450px;
    }
  }
    @media (max-width: 767px) {
      // .trigger-text {
      //   font-size: 2rem;
      //   margin-top: 0.5rem;
      //   align-items: center;
      // }
      // span.trigger-display {
      //   display: flex;
      //   font-size: 1.2rem;
      //   margin: 0;
      //   letter-spacing: 0.1rem;
      // }

    }
    @media (max-width: 450px) {
      span.trigger-icon {
        display: flex;
        transition: all 0.2s ease;
        &:hover {
          color: var(--tertiary-color);
        }
      }
      span.trigger-display {
        // display: none;
      }
      .dropdown-wrapper {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      height: auto;


    }
    .dropdown-content {
        position:fixed;
        top: 3rem;
        padding: 0;
        width: 100% !important;
        max-width: 450px;
        left: 0;
        right: 0;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      }
      .trigger-text {
        gap: 0;
      }
      .dropdown-trigger {
        margin: 0;
        margin-left: 0.5rem;
        padding: 0;
        height: auto;
        width: auto;
        position: fixed;
        right: auto;
        top: 0;
        left: 2rem;

        padding: 0 !important;
        justify-content: space-between;
        align-items: flex-start;
        border: none !important;
        &.selector {
          width: auto;
          height: 3rem;
          // overflow: hidden;
        }
        & span.icon {
          display: none;
        }
        & span.icon.home {
          display: flex;
          flex-direction: row;
          font-size: 1rem;
          justify-content: center;
          align-items: center;
          letter-spacing: 0.1rem;
          color: var(--tertiary-color);
          gap: 0;
          padding: 0;
          border-radius: 50%;
          & p {
            display: none;
          }
        }
        & span.selector {
          display: flex;
          flex-direction: row;
          font-size: 1rem;
          letter-spacing: 0.2rem;
      }

      }

    }
  </style>  
