<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';
  import { currentUser } from '$lib/pocketbase';
  import { getThreadsStore, createThreadsStore } from '$lib/stores/threadsStore';

  import { projectStore, getProjectStore } from '$lib/stores/projectStore';
  import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus, InfoIcon, ChartBarBig, Users } from 'lucide-svelte';
  import type { Projects, Thread } from '$lib/types/types';
  import { onMount } from 'svelte';
  import { t } from '$lib/stores/translationStore';
  import ProjectStatsContainer from '$lib/components/common/cards/ProjectStatsContainer.svelte';
  import ProjectCollaborators from '$lib/components/containers/ProjectCollaborators.svelte'

  export let projectId: string | undefined = undefined;
  let isExpanded = false;
  let activeTab: 'details' | 'stats' | 'members' = 'details';
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
  let isLoading: boolean = false;

  console.log('*** ProjectCard Initialization ***');
  console.log('Initial projectId received:', projectId);

  // Subscribe to the project store
  projectStore.subscribe((state) => {
    // Only proceed if we have a valid projectId or currentProjectId
    const targetId = projectId || state.currentProjectId;
    if (!targetId) return;
    
    project = state.threads.find(p => p.id === targetId) || null;
    
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
  function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
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
  $: projectMessagesCount = project?.threads?.length || 0;
  $: projectCollaboratorsCount = project?.collaborators?.length || 0;

  $: projectOwner = project?.owner || '';
  $: createdDate = formatDate(project?.created);
  $: updatedDate = formatDate(project?.updated);
  
  function toggleExpanded() {
    isExpanded = !isExpanded;
    if (isExpanded && projectId) {
      loadProjectThreadsData();
    }
  }
  $: if (projectId) {
  activeTab = 'details';
}
  function setActiveTab(tab: 'details' | 'stats' | 'members') {
    activeTab = tab;
    if (!isExpanded) {
      isExpanded = true;
      if (projectId) {
        loadProjectThreadsData();
      }
    }
  }

  async function loadProjectData() {
    if (!projectId) {
      console.log('No projectId provided, skipping load');
      return;
    }

    console.log('Loading data for projectId:', projectId);
    activeTab = 'details';
    isLoading = true;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        project = data.data;
        if ($currentUser) {
          isOwner = project.owner === $currentUser.id;
        }
      } else {
        throw new Error(data.error || 'Failed to fetch project');
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      errorMessage = 'Failed to load project data.';
    } finally {
      isLoading = false;
    }
  }

  
  async function loadProjectThreadsData() {
    console.log('*** loadProjectThreadsData called ***');
    
    if (!projectId) {
      console.error('No projectId available for loading threads');
      return;
    }
    
    try {
      // Create or get the threads store for this project
      const threadsStore = getThreadsStore(projectId) || await createThreadsStore(projectId);
      console.log('Threads store initialized for project:', projectId);
      
      // Fetch threads data if needed
      if (threadsStore && typeof threadsStore.loadThreads === 'function') {
        await threadsStore.loadThreads();
        console.log('Threads loaded for project:', projectId);
      }
    } catch (error) {
      console.error('Error loading project threads:', error);
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

  async function initializeComponent() {
    console.log('Initializing with projectId:', projectId);
    isLoading = true;
    
    try {
      // If no projectId but we have a current project in the store
      if (!projectId && $projectStore.currentProjectId) {
        projectId = $projectStore.currentProjectId;
      }

      if (projectId) {
        await loadProjectData();
        await loadProjectThreadsData();
        // await loadCollaborators();
      }
    } catch (error) {
      console.error('Error initializing component:', error);
    } finally {
      isLoading = false;
    }
  }
  
  onMount(async () => {
    console.log('Component mounting...');
    
    if (!$currentUser) {
      isLoading = true; 
      const unsubscribe = currentUser.subscribe((user) => {
        if (user) {
          unsubscribe();
          initializeComponent();
        } else {
          isLoading = false; 
        }
      });
      return;
    }
    
    await initializeComponent();
  });
</script>

<div class="project-container">
  <div class="project-content" transition:slide={{ duration: 200 }}>
    <div class="project-header">
      <!-- <h2>{$t('drawer.project')}</h2> -->
    </div>
    
    {#if project}
      <div class="current-project">
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
        
        <!-- New Tab Navigation -->
        <div class="tabs-navigation">
          <button 
            class="tab-button {activeTab === 'details' ? 'active' : ''}" 
            on:click={() => setActiveTab('details')}
          >
          <InfoIcon/>
            {$t('dashboard.projectDetails')}
          </button>
          <button 
            class="tab-button {activeTab === 'stats' ? 'active' : ''}" 
            on:click={() => setActiveTab('stats')}
          >
          <ChartBarBig/>
            {$t('dashboard.projectStats')}
          </button>
          <button 
            class="tab-button {activeTab === 'members' ? 'active' : ''}" 
            on:click={() => setActiveTab('members')}
          >
          <Users/>
            {$t('dashboard.projectMembers')}
          </button>
          <!-- <button class="toggle-button" on:click={toggleExpanded}>
            <ChevronDown class="icon-wrapper {isExpanded ? 'rotated' : ''}" size={16} />
          </button> -->
        </div>

        {#if isExpanded}
          <div class="project-tabs-content" transition:slide={{ duration: 150 }}>
            {#if activeTab === 'details'}
              <div class="project-details">
                <div class="detail-row">
                  <span class="detail-label">Collaborators:</span>
                  <span class="detail-value">{projectCollaboratorsCount}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Threads:</span>
                  <span class="detail-value">{projectThreadsCount}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Messages:</span>
                  <span class="detail-value">{projectMessagesCount}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Created:</span>
                  <span class="detail-value">{createdDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Updated:</span>
                  <span class="detail-value">{updatedDate}</span>
                </div>
              </div>
            {:else if activeTab === 'stats'}
              <div class="project-stats">
                <ProjectStatsContainer projectId={$projectStore.currentProjectId}/>
              </div>
            {:else if activeTab === 'members'}
            <div class="project-stats">
              <ProjectCollaborators projectId={$projectStore.currentProjectId}/>
            </div>
          {/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="no-project">
        <h2>Create or select project to see the dashboard items.</h2>
        <p >
          {getRandomQuote()}
        </p>
      </div>
    {/if}
  </div>
</div>
  <style lang="scss">
	@use "src/styles/themes.scss" as *;

    * {
      font-family: var(--font-family);

    }

    .no-project {

      height: 75vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      & p {
        font-style: italic;
        color: var(--placeholder-color);
        max-width: 600px;
      }
    }
    .project-container {
      // background: var(--bg-gradient);
		// backdrop-filter: blur(10px);
		border-radius: 20px;
		display: flex;
		flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: auto;
		margin-top: 0;
		margin-left: 0;
      transition: all 0.3s ease;
		position: relative;
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
  .project-tabs-content {
    overflow-y: auto;
    width: auto;
    gap: 2rem;
    display: flex;
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
    align-items: left;
    height: auto;
		width: 100%;
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
    margin-left: 2rem !important;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    // background-color: var(--secondary-color);
    width: 100%;
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
    position: static;

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
    width: 100%;

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
    width: 100%;

  }
  
  .detail-row {
    display: flex;
    letter-spacing: 0.2rem;
    margin-right: 2rem;
    border-bottom: 1px solid var(--secondary-color);
    justify-content: space-between;
      align-items: center;
    width: auto;
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
  @media (max-width: 1000px) {
    .current-project {
      display: flex;
      width: 100%;
      margin: 0 !important;
      align-items: flex-start;
      justify-content: center !important;

    }
    .project-tabs-content {
    overflow-y: auto;
    width: calc(100% - 2rem) !important;
    gap: 2rem;
    display: flex;
  }
    .project-content {
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
    height: auto;
		width: 100%;
    min-width: auto;
    flex: 1;
      top: 0;
		height: auto;
		margin-top: 0;
		margin-left: 0;
      left: 0;
		position: relative;
		overflow: hidden;

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
    width: 100% !important;

  }
  .detail-row {
    display: flex;
    letter-spacing: 0.2rem;
    border-bottom: 1px solid var(--secondary-color);
    justify-content: space-between;
      align-items: center;
    width: 100% !important;
    font-size: 1.2rem;
    height: 4rem;
    line-height: 1.5;
  }
  }

  </style>