<script lang="ts">
    import { fade, fly, slide } from 'svelte/transition';
    import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import { fetchProjects, resetProject, fetchThreadsForProject, updateProject, removeThreadFromProject, addThreadToProject} from '$lib/clients/projectClient';
    import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2 } from 'lucide-svelte';
    import type { Projects } from '$lib/types/types';
    import { onMount } from 'svelte';
  
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
    let filteredProjects: Projects[] = [];

    $: console.log('Store state:', $projectStore);
$: console.log('Filtered projects:', filteredProjects);
$: console.log('Is expanded:', isExpanded);
$: console.log('Current project:', $projectStore.currentProject);

async function handleCreateNewProject(name: string) {
  console.log('Creating new project with name:', name);
  if (!name.trim()) {
    console.log('Name is empty, returning');
    return;
  }
  
  try {
    isCreatingProject = true;
    console.log('Starting project creation...');
    const newProject = await projectStore.addProject({
      name: name.trim(),
      description: ''
    });
    console.log('New project created:', newProject);
    
    if (newProject) {
      newProjectName = '';
    }
  } catch (error) {
    console.error('Error in handleCreateNewProject:', error);
  } finally {
    console.log('Project creation completed');
    isCreatingProject = false;
  }
}

async function handleSelectProject(projectId: string) {
  console.log('Selecting project:', projectId);
  try {
    await projectStore.setCurrentProject(projectId);
    console.log('Project selected, new store state:', $projectStore);
    // Close dropdown
    isExpanded = false;
    // Set the projectId in the store
    projectStore.update(state => ({
      ...state,
      currentProjectId: projectId,
      currentProject: state.threads.find(p => p.id === projectId) || null
    }));
  } catch (error) {
    console.error("Error handling project selection:", error);
  }
}
  async function handleDeleteProject(e: Event, projectId: string) {
    e.stopPropagation();
  }

  $: filteredProjects = searchQuery 
  ? $projectStore.threads.filter(project => 
      project.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : $projectStore.threads;

  onMount(async () => {
  console.log('Component mounting...');
  try {
    await projectStore.loadProjects();
    console.log('Projects loaded:', $projectStore.threads);
  } catch (error) {
    console.error('Error in onMount:', error);
  }
});


  </script>
  
  <div class="dropdown-container">
    <button 
    class="dropdown-trigger"
    on:click={() => {
      console.log('Dropdown trigger clicked');
      isExpanded = !isExpanded;
      console.log('isExpanded set to:', isExpanded);
    }}
  >
    <span class="trigger-text">
        <span class="icon" class:rotated={isExpanded}>
            <ChevronDown size={16} />
          </span>
      {$projectStore.currentProject?.name || 'Select Project'}
    </span>
  </button>
  
    {#if isExpanded}
      <div 
        class="dropdown-content"
        transition:slide={{ duration: 200 }}
      >
        <div class="dropdown-header">
          <div class="search-bar">
            <Search size={16} />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search projects..."
            />
          </div>
          <button 
            class="create-btn"
            on:click={() => isCreatingProject = !isCreatingProject}
          >
            <PackagePlus size={16} />
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
              class="confirm-btn"
              disabled={!newProjectName.trim()}
              on:click={handleCreateNewProject}
            >
              <Check size={16} />
            </button>
          </div>
        {/if}
  
        <div class="projects-list">
          {#each filteredProjects as project (project.id)}
            <div 
              class="project-item"
              class:active={$projectStore.currentProjectId === project.id}
              on:click={() => handleSelectProject(project.id)}
            >
              <span class="project-name">{project.name}</span>
              <div class="project-actions">
                <button 
                  class="action-btn delete"
                  on:click|stopPropagation={(e) => handleDeleteProject(e, project.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <style lang="scss">
    .dropdown-container {
      position: relative;
      display: inline-block;
      min-width: 200px;
      z-index: 2000;
      
    }
  
    .dropdown-trigger {
      background: transparent;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      padding: 0.5rem 1rem;
      width: 100%;
      display: flex;
      align-items: center;
      border-radius: var(--radius-m);
      transition: all 0.2s ease;
  
      &:hover {
        background: var(--secondary-color);
      }
    }
  
    .trigger-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      font-size: var(--font-size-s);
      
      .icon {
        transition: transform 0.2s ease;
        
        &.rotated {
          transform: rotate(180deg);
        }
      }
    }
  
    .dropdown-content {
      position: absolute;
      top: 0;
      left: 2.5rem;
      min-width: 200px;
      height: 2rem;
      border: 1px solid var(--secondary-color);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);

      border-top-left-radius: var(--radius-s);
      border-top-right-radius: var(--radius-s);
    }
  
    .dropdown-header {
      display: flex;
      height: 2rem;
      gap: 0.5rem;
      border-bottom: 1px solid var(--secondary-color);
      
    }
  
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      color: var(--text-color);
      padding: 0.25rem 0.5rem;
      background: var(--secondary-color);


      input {
        background: transparent;
        border: none;
        color: var(--text-color);
        width: 100%;
        outline: none;
  
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
      padding: 0.25rem;
      border-radius: var(--radius-s);
  
      &:hover {
        background: var(--secondary-color);
        color: var(--tertiary-color);
      }
    }
  
    .create-form {
        display: flex;
      gap: 0.5rem;
  
      input {
        flex: 1;
        // padding: 0.5rem 1rem;
        border: none;
        border-radius: var(--radius-s);
        background: var(--secondary-color);
        color: var(--text-color);
      }
  
      .confirm-btn {
        background: transparent;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: var(--radius-s);
  
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
      max-height: 300px;
      overflow-y: auto;
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--secondary-color);
      border-right: 1px solid var(--secondary-color);
      border-left: 1px solid var(--secondary-color);

    }
  
    .project-item {
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      color: var(--placeholder-color);
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--secondary-color);
  
        .project-actions {
          opacity: 1;
        }
      }
  
      &.active {
        background: var(--tertiary-color);
        color: var(--text-color);
      }
    }
  
    .project-name {
      font-size: var(--font-size-s);
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
      border-radius: var(--radius-s);
  
      &:hover {
        background: var(--secondary-color);
        
        &.delete {
          color: red;
        }
      }
    }
  </style>