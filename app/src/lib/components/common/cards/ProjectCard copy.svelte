<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';
  import { currentUser } from '$lib/pocketbase';
  import { threadsStore } from '$lib/stores/threadsStore';
  import { cubicOut } from 'svelte/easing';
  import { projectStore } from '$lib/stores/projectStore';
  import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus, InfoIcon, ChartBarBig, Users, Logs, BrainCircuit } from 'lucide-svelte';
  import type { Projects, Threads } from '$lib/types/types';
  import { onMount } from 'svelte';
  import { t } from '$lib/stores/translationStore';
  import ProjectStatsContainer from '$lib/components/common/cards/ProjectStatsContainer.svelte';
  import ProjectCollaborators from '$lib/components/containers/ProjectCollaborators.svelte'
  import { isTextareaFocused } from '$lib/stores/textareaFocusStore';
  import { loadThreads } from '$lib/clients/threadsClient'; // Updated import

  export let projectId: string | undefined = undefined;
  export let activeTab: 'info' | 'details' | 'stats' | 'members' = 'info';
  export let previousActiveTab: 'info' | 'details' | 'stats' | 'members' | null = null;
  let isExpanded = false;
  let isExpandedContent = false;

  let isCreatingProject = false;
  let newProjectName = '';
  let searchQuery = '';
  let hoveredGenerate = false;
  let hoveredEdit = false;
  let hoveredConfirm = false;

  let isEditingProjectName = false;
  let editingProjectId: string | null = null;
  let isEditingProjectDescription = false;
  let editedProjectDescription = '';
  let editedProjectName = '';
  let project: Projects | null = null;
  let isOwner: boolean = false;
  let errorMessage: string = '';
  let isLoading: boolean = false;
  let unsubscribeProjectStore: () => void;
  let unsubscribeThreadsStore: () => void;

  console.log('*** ProjectCard Initialization ***');
  console.log('Initial projectId received:', projectId);
  $: console.log('Textarea is focused:', $isTextareaFocused);

  // Subscribe to the project store

  
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
    if (Array.isArray(quotes)) {
      return quotes[Math.floor(Math.random() * quotes.length)];
    }
    return 'Loading...';
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
  function toggleDescription() {
    isExpandedContent = !isExpandedContent;
  }
  $: if (projectId) {
    activeTab = 'info';
  }

  $: if ($isTextareaFocused) {
    // When textarea gets focus, remember the current tab but set active to null
    if (activeTab) {
      previousActiveTab = activeTab;
      activeTab = null as any; // Type assertion to handle null case
    }
  } else {
    // When textarea loses focus, restore the previous tab if we have one
    if (previousActiveTab) {
      activeTab = previousActiveTab;
    } else {
      // Set default tab to 'info' if there's no previous tab
      activeTab = 'info';
    }
  }

  function setActiveTab(tab: 'info' | 'details' | 'stats' | 'members') {
    // If textarea is focused, store the requested tab but don't change activeTab
    if ($isTextareaFocused) {
      previousActiveTab = tab;
      return;
    }
    
    // Otherwise, set the active tab and store it as the previous tab too
    activeTab = tab;
    previousActiveTab = tab;
    
    // Handle expansion
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
    activeTab = 'info';
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
          activeTab = 'info';

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
    console.log('Loading threads for project:', projectId);
    
    if (!projectId) {
      console.error('No projectId available for loading threads');
      return;
    }
    
    try {
      // Use the updated loadThreads function with projectId
      await loadThreads(projectId);
      console.log('Threads loaded for project:', projectId);
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
  if (!projectId) return;

  isLoading = true;
  activeTab = 'info'; // Explicitly set tab
  
  try {
    await loadProjectData();
    await loadProjectThreadsData();
  } catch (error) {
    console.error('Initialization error:', error);
    errorMessage = 'Failed to initialize project';
  } finally {
    isLoading = false;
  }
}

  onMount(async () => {
  console.log('Component mounting...');
  
  // Set initial tab state
  activeTab = 'info';
  previousActiveTab = 'info';
  
  // Set up store subscriptions
  unsubscribeProjectStore = projectStore.subscribe(async (state) => {
    const targetId = projectId || state.currentProjectId;
    if (!targetId) return;
    
    const foundProject = state.threads.find(p => p.id === targetId);
    if (foundProject && (!project || project.id !== foundProject.id)) {
      project = foundProject;
      if ($currentUser) {
        isOwner = project.owner === $currentUser.id;
      }
      // Ensure info tab is active when project changes
      activeTab = 'info';
      previousActiveTab = 'info';
      
      // Load threads for the project
      await loadProjectThreadsData();
    }
  });

  if (!$currentUser) {
    isLoading = true;
    const unsubscribeUser = currentUser.subscribe((user) => {
      if (user) {
        unsubscribeUser();
        initializeComponent();
      } else {
        isLoading = false;
      }
    });
    return;
  }
  
  await initializeComponent();
  
  return () => {
    unsubscribeProjectStore?.();
    unsubscribeThreadsStore?.();
  };
});
</script>

<div class="project-container">
  <div class="project-content" transition:slide={{ duration: 200 }}>
    <div class="project-header"                 transition:slide={{ duration: 300 }}
    >
      <!-- <h2>{$t('drawer.project')}</h2> -->
    </div>
    
    {#if project}
    
      <div class="current-project" transition:slide={{ duration: 300 }}
      >
        {#if isEditingProjectName && editingProjectId === project.id}
          <div class="edit-name-container">
            <input
              bind:value={editedProjectName}
              on:keydown={(e) => e.key === 'Enter' && saveProjectEdit('name')}
              autofocus
            />
            <button class="save-button" on:click={() => saveProjectEdit('name')}>
              <Check/>
            </button>
          </div>
        {:else}
          {#if isExpanded}
          {:else}
            <div class="project-name-container">
              <!-- <h3 class="project-name">{projectName}</h3> -->
              {#if isOwner}
                <button class="edit-button" 
                on:click={() => handleEditProject('name')}
                on:mouseenter={() => hoveredGenerate = true}
                on:mouseleave={() => hoveredGenerate = false}
                
                >
                <div class="icon" in:fade>
                  <Pen size={14} />
                  {#if hoveredGenerate}
                    <span class="tooltip" in:fade>
                      {$t('tooltip.newThread')}
                    </span>
                  {/if}
                </div> 
                </button>
              {/if}
            </div>
            {/if}
        {/if}
        <div class="tabs-navigation project">
          <button 
            class="tab-button {activeTab === 'info' ? 'active' : ''}" 
            on:click={() => setActiveTab('info')}
          >
          <span>
            <InfoIcon/>
            <p>
              {$t('dashboard.projectInfo')}
            </p>
          </span>
        </button>
          <button 
            class="tab-button {activeTab === 'details' ? 'active' : ''}" 
            on:click={() => setActiveTab('details')}
          >
          <span>
          <Logs/>
            <p>
              {$t('dashboard.projectDetails')}
            </p>
          </span>
          </button>
          <button 
            class="tab-button {activeTab === 'stats' ? 'active' : ''}" 
            on:click={() => setActiveTab('stats')}
          >
          <span>
          <ChartBarBig/>
            <p>
              {$t('dashboard.projectStats')}
            </p>
          </span>
          </button>
          <button 
            class="tab-button {activeTab === 'members' ? 'active' : ''}" 
            on:click={() => setActiveTab('members')}
          >
          <span>
            <Users/>

            <p>
              {$t('dashboard.projectMembers')}
            </p>
          </span>
          </button>
          <!-- <button class="toggle-button" on:click={toggleExpanded}>
            <ChevronDown class="icon-wrapper {isExpanded ? 'rotated' : ''}" size={16} />
          </button> -->
        </div>
          <div class="project-tabs-content" transition:slide={{ duration: 150 }}>
            {#if activeTab === 'info'}
              {#if isEditingProjectDescription && editingProjectId === project.id}
                <div class="edit-description-container" >
                  <textarea
                    bind:value={editedProjectDescription}
                    class="edit-description-input"
                    rows="3"
                    autofocus
                  ></textarea>
                  <button class="save-button" on:click={() => saveProjectEdit('description')}>
                    {$t('tooltip.done')}
                    <Check />
                  </button>
                </div>
              {:else if projectDescription}
  
                  <div class="project-description-container"
                  class:expanded={isExpandedContent}
                  on:click={toggleDescription}
                  >
                    <p 
                    class="project-description" 
                  >
                    {projectDescription}
                  </p>
                    {#if isOwner}
                    <span class='edit-btns'>
                      <button class="edit-button generate" 
                      on:click={() => handleEditProject('description')}
                      on:mouseenter={() => hoveredGenerate = true}
                      on:mouseleave={() => hoveredGenerate = false}
                      >
                      <div class="icon" in:fade>
                        <BrainCircuit/>
                        {#if hoveredGenerate}
                          <span class="tooltip" in:fade>
                            {$t('tooltip.generateHints')}
                          </span>
                        {/if}
                      </div> 
                      </button>

                      <button class="edit-button" 
                      on:click={() => handleEditProject('description')}
                      on:mouseenter={() => hoveredEdit = true}
                      on:mouseleave={() => hoveredEdit = false}
                      >
                      <div class="icon" in:fade>
                        <Pen/>
                        {#if hoveredEdit}
                          <span class="tooltip" in:fade>
                            {$t('tooltip.editDescription')}
                          </span>
                        {/if}
                      </div> 
                      </button>
                    </span>

                    {/if}
                  </div>
                  <div class="project-sidenav">
                    <ProjectCollaborators projectId={$projectStore.currentProjectId}/>

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

                    <ProjectStatsContainer projectId={$projectStore.currentProjectId}/>
                    {#if isExpandedContent}
                    {:else}
                    <span class="prompts">
                        <span class="prompt">
                          Find out why there are no clear project goals.
                        </span>
                        <span class="prompt">
                          Find 
                        </span>
                        <span class="prompt">
                          test
                        </span>
                    </span>
                    {/if}
                  </div>



                  <!-- <h2>test</h2> -->
                  <!-- <span class="prompts">
                    {#each promptSuggestions as prompt}
                      <span 
                        class="prompt" 
                        on:click={() => handleStartPromptSelection(prompt)}
                        on:keydown={(e) => e.key === 'Enter' && handleStartPromptSelection(prompt)}
                        role="button"
                        tabindex="0"
                      >
                        {prompt}
                      </span>
                    {/each}
                  </span> -->
                  
              {:else if isOwner}
                <div class="add-description-container">
                  <button class="toggle-btn" on:click={() => handleEditProject('description')}>
                    <Plus size={14} /> Add description
                  </button>
                </div>
              {/if}
            {:else if activeTab === 'details'}
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
      </div>
    {:else}
      <div class="no-project">
        <!-- <h2>Create or select project to see the dashboard items.</h2> -->
        <!-- <p >
          {getRandomQuote()}
        </p> -->
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

      height: auto;
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
    width: auto;
    height: 100%;
    position: relative;
    gap: 2rem;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 0;
  }

  .project-sidenav {
    display: flex;
    flex-direction: column;
    height: auto;
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
		// backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
    align-items: left;
    justify-content: flex-start;
    height: auto;
    position: relative;
		width: 100%;
    flex: 1;		
		margin-left: 0;
      left: 0;
		position: relative;
    transition: all 0.3s ease;

	}
  
  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    transition: all 0.3s ease;

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

        &.prompts {
          justify-content: center !important;
          align-items: flex-end;
          width: 100%;
          
        }
        &.prompt {
          padding: 1rem;
          border: 1px solid var(--line-color);
          letter-spacing: 0.2rem;
          font-size: 1.1rem;
        }
  }


    textarea {
      background: var(--secondary-color);
      outline: none;
      border: 1px solid var(--tertiary-color);
      padding: 1rem;
      font-size: 1.1rem;
      height: 50vh;
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
  

  .tabs-navigation {
    justify-content:flex-end;
    align-items: flex-end;
    position: relative;
    margin-top: 0;
    gap: 0.5rem;
    display: flex;

      width: auto;
      margin-top: 0;
    &.project {
      width: auto;
      top: 0;
      gap: auto;
      z-index: 3000;

    }
  }


  
  .tab-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1rem;
		font-size: 1rem;
		background: transparent;
		border: none !important;
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--placeholder-color);
		opacity: 0.7;
    border-radius: 1rem;
		&.active {
			opacity: 1;
			font-weight: 600;
      color: var(--tertiary-color);

		}
		&:hover {
			background: transparent;
      border-radius: 1rem;
      color: var(--text-color);
      border-bottom: 1px solid green;

		}
    & span {
      display: flex;
      gap: 0.5rem;
    }
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
    // padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    height: auto;
    // background-color: var(--secondary-color);
    width: 100%;
    transition: all 0.3s ease;
    &:hover {
      cursor: pointer;
      transition: all 0.3s ease;

      // background: var(--primary-color);
      // .project-description-container {
      //   display: flex;
        
      // }
    }
  }
  
  .project-name-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    &:hover {
      button.edit-button {
        display: flex;


      }
    }
  }
  .project-name {
    font-size: 4.2rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    width: 100%;
    color: var(--accent-color);
    text-align: center;

    & h3.project-name {
    }

  }
  .project-description-container {
    display: flex;
    flex-direction: row;
    justify-content: top;
    align-items: top;
    gap: 1rem;
    position: relative;
    height: 10rem;
    display: flex;
    transition: all 0.3s ease;
    &.expanded {

      & .project-description {
        font-size: 1rem;
        border: 1px solid var(--line-color);

      }
      max-height: auto; 
      height: 64vh;
      overflow-y: auto; 
      position: relative;
    }
    &:hover {

      button.edit-button {
        display: flex;
      }
    }
  }
  .project-description {
    font-size: 1.2rem;
    letter-spacing: 0.1rem;
    text-justify: justify;
    text-align: justify;
    line-height: 2;
    height: auto;
    width: auto;
    border-radius: 2rem;

    display: flex;
    justify-content: flex-start;
    padding: 1rem;
    color: var(--text-color);
    transition: all 0.3s ease;
    overflow-y: scroll;
    white-space: pre-line;
    scrollbar-width: thin;
    scroll-behavior: smooth;
    scrollbar-color: var(--placeholder-color) transparent;
    background: var(--secondary-color);
    transition: all 0.3s ease;
    
    &:hover {
      background: var(--primary-color);
    }



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
  
  .edit-name-container,  .edit-description-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 8px;
    margin-left: 2rem;
    margin-right: 2rem;
    gap: 1rem;
    width: 100%;
    height: 500px;
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    padding: 1rem;
    gap: 0.5rem;
    background: var(--bg-color);
    border-radius: 1rem;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.3s ease;

    &:hover {
      background: var(--primary-color);
      width: 100%;
    }
  }
  
  span.edit-btns {
    display: flex;
    flex-direction: row;
    position: absolute;
    right:0;
    height: auto;
    transition: all 0.3s ease;
  }

  button.edit-button.generate {
      &:hover {
        background-color: var(--tertiary-color);
        transform: scale(1.1);
        opacity: 1;


      }
    }
  button.edit-button {
    background: transparent;
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
    opacity: 1;
    z-index: 1000;
    & .tooltip {
      letter-spacing: 0.2rem;
      font-size: 1rem;
    }
    &:hover {
      background-color: var(--bg-color);
      transform: scale(1.1);
      opacity: 1;
      & .tooltip {
          color: var(--text-color);
        }
    }

  }
  

  .no-project {
    display: flex;

    padding: 0.5rem;
    width: 100%;
    text-align: center;
    color: var(--text-secondary-color);

    & p {
      color: var(--placeholder-color);
      max-width: 800px;
    }
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
      align-items: center;
      justify-content: center;

    }
    .project-tabs-content {
    width: calc(100% - 2rem) !important;
    gap: 2rem;
    display: flex;
  }

  
    .project-content {
		// backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
    height: 100%;
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

  @media (max-width: 767px) {
    .current-project {
      align-items: flex-end;
    }
    .project-content {
      margin-top: -0.5rem !important;
    }
    .tabs-navigation.project {
      gap: 0;
      margin-top: 0 !important;
      justify-content: flex-end;
      align-items: flex-end;
      width: auto !important;
    }
    .tab-button {
      width: 2.5rem;
      height: 2.5rem;
      justify-content: center;

      & span {
        & p {
          display: none;

        }
      }
    }
  }

  </style>