<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';
  import { pb, currentUser } from '$lib/pocketbase';
  import { projectStore, getProjectStore } from '$lib/stores/projectStore';
  import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus } from 'lucide-svelte';
  import type { Projects } from '$lib/types/types';
  import { onMount } from 'svelte';
  import { t } from '$lib/stores/translationStore';

  export let projectId: string | undefined = undefined;
  let isExpanded = false;
  let isCreatingProject = false;
  let newProjectName = '';
  let searchQuery = '';
  let createHovered = false;
  let isEditingProjectName = false;
  let editingProjectId: string | null = null;
  let isEditingProjectDescription = false;
let editedProjectDescription = '';
  let editedProjectName = '';
  let project: Projects | null = null;
  let isOwner: boolean = false;
  let errorMessage: string = '';

  console.log('*** ProjectCard Initialization ***');
  console.log('Initial projectId received:', projectId);

  // Subscribe to the project store
  projectStore.subscribe((state) => {
  console.log('Store state:', state);
  
  // If we have a projectId, try to find that specific project
  if (projectId && state.currentProjectId === projectId) {
    project = state.threads.find(p => p.id === projectId) || null;
  } 
  // If we don't have a projectId but there is a currentProjectId in the store
  else if (!projectId && state.currentProjectId) {
    projectId = state.currentProjectId;
    project = state.threads.find(p => p.id === state.currentProjectId) || null;
  }
  
  // Update owner status
  if (project && $currentUser) {
    isOwner = project.owner === $currentUser.id;
  }
});
$: if ($projectStore.currentProjectId && !projectId) {
  projectId = $projectStore.currentProjectId;
  loadProjectData();
}
  // Format date nicely
  function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  }
  
  // Reactive declarations for project details
  $: {
    console.log('*** Reactive Update ***');
    console.log('Current project value:', project);
    console.log('Current projectId:', projectId);
  }
  
  $: projectName = project?.name || 'No Project Selected';
  $: projectDescription = project?.description || '';
  $: projectThreadsCount = project?.threads?.length || 0;
  $: projectCollaboratorsCount = project?.collaborators?.length || 0;

  $: projectOwner = project?.owner || '';
  $: createdDate = formatDate(project?.created);
  $: updatedDate = formatDate(project?.updated);
  
  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  async function loadProjectData() {
    console.log('*** loadProjectData called ***');
    console.log('Loading data for projectId:', projectId);
    
    try {
      // First check the store for the project data
      const storeState = getProjectStore();
      console.log('Store state threads count:', storeState.threads.length);
      console.log('Store state currentProjectId:', storeState.currentProjectId);
      
      const projectFromStore = storeState.threads.find(p => p.id === projectId);
      console.log('Project found in store?', !!projectFromStore);
      
      if (projectFromStore) {
        console.log('Using project from store:', projectFromStore.name);
        project = projectFromStore;
      } else {
        console.log('Project not found in store, fetching from PocketBase...');
        // If not in store, fetch directly from PocketBase
        try {
          project = await pb.collection('projects').getOne<Projects>(projectId);
          console.log('Project fetched from PocketBase:', project?.name);
        } catch (pbError) {
          console.error('PocketBase fetch error:', pbError);
        }
      }
      
      if (project && $currentUser) {
        isOwner = project.owner === $currentUser.id;
        console.log('Current user is owner:', isOwner);
        console.log('Project owner:', project.owner);
        console.log('Current user ID:', $currentUser.id);
      } else {
        console.log('Cannot determine ownership - project or currentUser missing');
        console.log('project:', project);
        console.log('currentUser:', $currentUser);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      errorMessage = 'Failed to load project data.';
    }
  }
  
  function handleEditProject(type: 'name' | 'description') {
  if (!project) return;
  
  if (type === 'name') {
    isEditingProjectName = true;
    editingProjectId = project.id;
    editedProjectName = project.name || '';
  } else if (type === 'description') {
    isEditingProjectDescription = true;
    editingProjectId = project.id;
    editedProjectDescription = project.description || '';
  }
}
async function saveProjectEdit(type: 'name' | 'description') {
  if (!editingProjectId) {
    isEditingProjectName = false;
    isEditingProjectDescription = false;
    return;
  }
  
  try {
    if (type === 'name' && editedProjectName.trim()) {
      await projectStore.updateProject(editingProjectId, {
        name: editedProjectName.trim()
      });
      isEditingProjectName = false;
    } else if (type === 'description') {
      await projectStore.updateProject(editingProjectId, {
        description: editedProjectDescription.trim()
      });
      isEditingProjectDescription = false;
    }
    
    editingProjectId = null;
  } catch (error) {
    console.error(`Error updating project ${type}:`, error);
  }
}
  
  onMount(async () => {
    console.log('*** Component mounting... ***');
    console.log('ProjectId at mount time:', projectId);
    
    try {
      // Check if projectId is valid
      if (!projectId) {
        console.error('ProjectId is empty or invalid at mount time');
        return;
      }
      
      // Log current user status
      console.log('Current user at mount time:', $currentUser?.id);
      
      await loadProjectData();
      console.log('After loadProjectData - project:', project?.name);
    } catch (error) {
      console.error('Error in onMount:', error);
    }
  });
</script>

<div class="project-container">
  <div class="project-content" transition:slide={{ duration: 200 }}>
    <div class="project-header">
      <!-- <h2>{$t('drawer.project')}</h2> -->

    </div>
    
    {#if project}
      <div class="current-project" on:click={toggleExpanded}>

        {#if isEditingProjectName && editingProjectId === project.id}
          <div class="edit-name-container">
            <input
              bind:value={editedProjectName}
              on:keydown={(e) => e.key === 'Enter' && saveProjectEdit('name')}
              autofocus
            />
            <button class="save-button" on:click={() => saveProjectEdit('name')}>
              <Check size={16} />
            </button>
          </div>
        {:else}
          <div class="project-name-container">
            <h3 class="project-name">{projectName}</h3>
            {#if isOwner}
            <button class="edit-button" on:click={() => handleEditProject('name')}>
              <Pen size={14} />
              </button>
            {/if}
          </div>
        {/if}

        {#if isEditingProjectDescription && editingProjectId === project.id}
        <div class="edit-description-container">
          <textarea
            bind:value={editedProjectDescription}
            class="edit-description-input"
            rows="3"
            autofocus
          ></textarea>
          <button class="save-button" on:click={() => saveProjectEdit('description')}>
            <Check size={16} />
          </button>
        </div>
      {:else if projectDescription}
        <div class="project-description-container">
          <p class="project-description">{projectDescription}</p>
          {#if isOwner}
            <button class="edit-button" on:click={() => handleEditProject('description')}>
              <Pen size={14} />
            </button>
          {/if}
        </div>
      {:else if isOwner}
        <div class="add-description-container">
          <button class="toggle-btn" on:click={() => handleEditProject('description')}>
            <Plus size={14} /> Add description
          </button>
        </div>
      {/if}
        
        {#if isExpanded}
          <div class="project-details" transition:slide={{ duration: 150 }}>
            <div class="detail-row">
              <span class="detail-label">Collaborators:</span>
              <span class="detail-value">{projectCollaboratorsCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Threads:</span>
              <span class="detail-value">{projectThreadsCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Created:</span>
              <span class="detail-value">{createdDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Updated:</span>
              <span class="detail-value">{updatedDate}</span>
            </div>

            
            <!-- {#if $projectStore.collaborators && $projectStore.collaborators.length > 0}
              <div class="collaborators">
                <h4>Collaborators</h4>
                <ul class="collaborator-list">
                  {#each $projectStore.collaborators as collaborator}
                    <li class="collaborator-item">
                      {collaborator.name || collaborator.username || collaborator.email || 'Unknown user'}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if} -->
          </div>
        {/if}
      </div>
    {:else}
      <div class="no-project">
        <h2>Create new project to see the dashboard items.</h2>
      </div>
    {/if}
    {#if projectId}

  {/if}
  </div>
</div>
  <style lang="scss">
	@use "src/styles/themes.scss" as *;

    * {
      font-family: var(--font-family);

    }
    .project-container {
      // background: var(--bg-gradient);
		// backdrop-filter: blur(10px);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 800px;
		margin-top: 0;
		margin-left: 0;
      transition: all 0.3s ease;
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

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    transition: color 0.2s ease;
    color: var(--placeholder-color);
      
      &.active {
        color: var(--tertiary-color);
      }

      &:hover {
        color: var(--tertiary-color);
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
  
    .project-content {
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
    height: auto;
		width: 100%;
    min-width: 600px;
    flex: 1;
      top: 0;
		height: auto;
		margin-top: 0;
		margin-left: 0;
      left: 0;
		position: relative;
		overflow: hidden;

	}
  
  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      color: var(--text-color);
      padding: 0.25rem 0.5rem;
      background: var(--secondary-color);
      border-radius: var(--radius-m);


      input {
        background: transparent;
        border: none;
        color: var(--text-color);
        width: 100%;
        outline: none;
        font-size: 1rem;

        &::placeholder {
          color: var(--placeholder-color);
        }
      }
    }
  
    .create-btn {
      background: var(--secondary-color);
      border: none;
      color: var(--text-color);
      cursor: pointer;
      width: 50px;
      height: 50px;
      border-radius: 50%;
  
      &:hover {
        background: var(--tertiary-color);
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

    .edit-description-container {
      display: flex;
    }
    textarea {
      background: var(--primary-color) !important;
      outline: none;
      border: 1px solid var(--secondary-color);
      padding: 1rem;
      font-size: 1rem;

      resize: none;
      width: 100%;
      border-radius: 1rem;
      color: var(--text-color);
    }
  
    input {
      background: var(--primary-color) !important;
      outline: none;
      border: 1px solid var(--secondary-color);
      padding: 1rem;
      font-size: 1rem;
      border-radius: 1rem;
      color: var(--text-color);
    }
  
    .tooltip {
    position: absolute;
    margin-right: 50px;
    margin-top: 100px;
    font-size: 0.7rem;
    white-space: nowrap;
    background-color: var(--secondary-color);
    backdrop-filter: blur(80px);
    border: 1px solid var(--secondary-color);
      font-weight: 100;
      animation: glowy 0.5s 0.5s initial;    
    padding: 4px 8px;
    border-radius: var(--radius-s);
    transition: all 0.2s ease ;
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
        font-size: 100px; 
        transform: translateX(1rem);
        margin-right: 1rem;

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
  
    h3.project-name {
      font-size: 2rem;
    }
  
    .project-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  
    button.action-btn {
      background: transparent;
      border: none;
      color: var(--text-color);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: var(--radius-s);
      &.delete {
          color: red;
        }
      &:hover {
        background: var(--secondary-color);
        
        &.delete {
          color: red;
        }
      }
    }

    .icon-wrapper {
    transition: transform 0.2s ease;
  }
  
  .rotated {
    transform: rotate(180deg);
  }


  
  .current-project {
    padding: 1rem;
    border-radius: 6px;
    transition: all 0.3s ease;

    // background-color: var(--secondary-color);

    &:hover {
      cursor: pointer;
      // background: var(--primary-color);

    }
  }
  
  .project-name-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    &:hover {
      button.edit-button {
        display: flex;


      }
    }
  }
  
  .project-name {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--accent-color);
  }
  .project-description-container {
    display: flex;
    flex-direction: row;
    justify-content: top;
    align-items: top;
    gap: 2rem;

    &:hover {
      button.edit-button {
        display: flex;
      }
    }
  }
  .project-description {
    font-size: 1.1rem;
    text-justify: justify;
    text-align: justify;
    line-height: 2;
    height: auto;
    width: auto;
    display: flex;
    padding: 1rem;
    color: var(--text-color);
    transition: all 0.3s ease;

  }
  
  .project-details {
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    // border-bottom-left-radius: 2rem;
    gap: 1rem;
    // border-left: 5px solid var(--tertiary-color);
    margin-top: 1rem;
    padding-top: 1rem;
    // border-bottom: 1px solid var(--tertiary-color);

  }
  
  .detail-row {
    display: flex;
    letter-spacing: 0.2rem;
    margin-left: 2rem;
    border-bottom: 1px solid var(--secondary-color);
    justify-content: space-between;
    align-items: center;

    font-size: 1.2rem;
    height: 4rem;
    line-height: 1.5;
  }
  
  .detail-label {
    color: var(--text-secondary-color);
  }
  
  .detail-value {
    font-weight: 500;
  }
  
  .toggle-button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    padding: 4px;
    border-radius: 4px;
  }
  
  .toggle-button:hover {
    background-color: var(--hover-color);
  }
  
  .edit-name-container {
    display: flex;
    margin-bottom: 8px;
  }
  
  .edit-name-input {
    flex: 1;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-color);
    color: var(--text-color);
  }


  
  .save-button {
    background-color: var(--accent-color);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    margin-left: 4px;
    cursor: pointer;
    color: white;
  }
  
  button.edit-button {
    background: transparent;
    position: absolute;
    right:0;
    background: var(--secondary-color);
    border: none;
    cursor: pointer;
    padding: 0.5rem 1rem;
    width: auto;
    height: 3rem;
    display: none;
    justify-content: center;
    align-items: center;
    color: var(--text-color);
    border-radius: 1rem;
    opacity: 0.5;
    z-index: 1000;

    &:hover {
    background-color: var(--bg-color);
    transform: scale(1.1);
    opacity: 1;

  }
  }
  

  
  .no-project {
    padding: 12px;
    text-align: center;
    color: var(--text-secondary-color);
    margin-bottom: 2rem;
  }
  
  .collaborators {
    margin-top: 12px;
  }
  
  .collaborators h4 {
    font-size: 0.9rem;
    margin: 0 0 4px 0;
    color: var(--text-secondary-color);
  }
  
  .collaborator-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .collaborator-item {
    font-size: 0.85rem;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .collaborator-item:last-child {
    border-bottom: none;
  }
  </style>