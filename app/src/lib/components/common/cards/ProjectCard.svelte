<script lang="ts">
    import { fade, fly, slide } from 'svelte/transition';
    import { pb, currentUser, checkPocketBaseConnection, updateUser } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import { fetchProjects, resetProject, fetchThreadsForProject, updateProject, removeThreadFromProject, addThreadToProject} from '$lib/clients/projectClient';
    import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus } from 'lucide-svelte';
    import type { Projects } from '$lib/types/types';
    import { onMount } from 'svelte';
    import { threadsStore } from '$lib/stores/threadsStore';
    import { t } from '$lib/stores/translationStore';

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

async function handleCreateNewProject(nameOrEvent?: string | Event) {
  const projectName = typeof nameOrEvent === 'string' ? nameOrEvent : newProjectName;
  
  console.log('Creating new project with name:', projectName);
  if (!projectName.trim()) {
    console.log('Name is empty, returning');
    return;
  }
  
  try {
    isCreatingProject = true;
    console.log('Starting project creation...');
    const newProject = await projectStore.addProject({
      name: projectName.trim(),
      description: ''
    });
    console.log('New project created:', newProject);
    
    if (newProject) {
      newProjectName = '';
      isCreatingProject = false;
      isExpanded = false;
      
      // Select the newly created project
      await handleSelectProject(newProject.id);
      console.log('New project selected:', newProject.id);
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
    
    isExpanded = false;
    
    // Set the projectId in the store
    projectStore.update(state => ({
      ...state,
      currentProjectId: projectId,
      currentProject: state.threads.find(p => p.id === projectId) || null
    }));

    // Show thread list when project is selected
    threadsStore.update(state => ({
      ...state,
      showThreadList: true
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
  
  <div class="project-container">

  
      <div 
        class="project-content"
        transition:slide={{ duration: 200 }}
      >
      <h2>{$t('drawer.project')}</h2>

        <div class="project-header">
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
            <Plus size={16} />
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
              on:click={() => handleCreateNewProject(newProjectName)}
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
  </div>
  
  <style lang="scss">

    * {
      font-family: var(--font-family);

    }
    .project-container {
      // background: var(--bg-gradient);
		backdrop-filter: blur(10px);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
    align-items: flex-start;

		max-width: 350px;
      padding: 2rem;

		margin-top: 0;
		margin-left: 0;

		position: relative;
		overflow: hidden;
		// box-shadow:
		// 	8px 8px 16px rgba(0, 0, 0, 0.3),
		// 	-8px -8px 16px rgba(255, 255, 255, 0.1);
	}

  .project-container::before {
		content: '';
		position: absolute;
		top: -150%;
		left: -150%;
		width: 300%;
		height: 300%;
		background: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2)
		);
		transform: translateX(-100%) rotate(45deg);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

  @keyframes swipe {
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}

	.project-container:hover::before {
		animation: swipe 0.5s cubic-bezier(0.42, 0, 0.58, 1);
		opacity: 1;
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
  
    .project-content {
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
		max-width: 400px;
      top: 0;
    bottom: 2rem;
		height: auto;
		margin-top: 0;
		margin-left: 0;
      left: 0;
		position: relative;
		overflow: hidden;

	}
  
    .project-header {
      display: flex;
      height: auto;
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
  

    .project-item {
      display: flex;
		align-items: center;
		position: relative;
		padding: 1rem;
		margin-bottom: 8px;
		justify-content: space-between;
		color: #cccccc;
		font-size: 20px;
		overflow: hidden;
		transition: all 0.5s ease;
		border-radius: 0.5rem;
		background: linear-gradient(
			to right,
			rgba(0, 128, 0, 0.2) var(--progress),
			rgba(128, 128, 128, 0.1) var(--progress)
		);
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

    .project-item:hover {
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 20%,
			rgba(247, 247, 247, 0.2) 96%
		);
	}

	.project-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			rgba(1, 149, 137, 0.5) var(--progress),
			transparent var(--progress)
		);
		z-index: -1;
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