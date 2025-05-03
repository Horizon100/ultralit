<script lang="ts">
  import { fade, fly, slide } from 'svelte/transition';
  import { currentUser } from '$lib/pocketbase';
  import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
  import { cubicOut } from 'svelte/easing';
  import { projectStore } from '$lib/stores/projectStore';
  import { Box, MessageCircleMore, ArrowLeft, ChevronDown, PackagePlus, Check, Search, Pen, Trash2, Plus, InfoIcon, ChartBarBig, Users, Logs, BrainCircuit } from 'lucide-svelte';
  import type { Projects, Threads } from '$lib/types/types';
  import { onMount } from 'svelte';
  import { generateAISuggestions } from '$lib/clients/aiClient';
  import { t } from '$lib/stores/translationStore';
  import ProjectStatsContainer from '$lib/components/common/cards/ProjectStatsContainer.svelte';
  import ProjectCollaborators from '$lib/components/containers/ProjectCollaborators.svelte'
  import { isTextareaFocused } from '$lib/stores/textareaFocusStore';
  import { loadThreads } from '$lib/clients/threadsClient'; // Updated import
  import { get } from 'svelte/store';
  import { pendingSuggestion } from '$lib/stores/suggestionStore';
  import { goto } from '$app/navigation';
  import { modelStore } from '$lib/stores/modelStore';
  import { messagesStore } from '$lib/stores/messagesStore';

  import { defaultModel, availableModels } from '$lib/constants/models';
  import handleSendMessage from '$lib/components/ai/AIChat.svelte'
  export let projectId: string | undefined = undefined;
  export let activeTab: 'info' | 'details' | 'stats' | 'members' = 'info';
  export let previousActiveTab: 'info' | 'details' | 'stats' | 'members' | null = null;
  let isExpanded = false;
  let isExpandedContent = false;
  let isGeneratingSuggestions = false;

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

async function handleProjectSuggestions() {
  if (!project || !project.description) {
    // Use your app's notification system or you can add alert/notification logic
    alert('Project needs a description to generate suggestions');
    return;
  }
  
  try {
    // Show loading state
    isGeneratingSuggestions = true;
    
    // Get current model from store or use default
    const modelState = get(modelStore);
    const aiModel = modelState.selectedModel || defaultModel;
    
    // Get current user ID
    const userId = $currentUser?.id;
    if (!userId) {
      throw new Error('User must be logged in to generate suggestions');
    }
    
    // Generate suggestions
    const suggestions = await generateAISuggestions(project.description, aiModel, userId);
    
    // Update project in database with new suggestions
    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aiSuggestions: suggestions
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update project with AI suggestions');
    }
    
    // Update local project data
    project = {
      ...project,
      aiSuggestions: suggestions
    };
    
    // Show success message - use your preferred notification method
    console.log('AI suggestions generated successfully');
    
  } catch (error) {
    console.error('Error in handleProjectSuggestions:', error);
    // Use your app's error notification method
    alert(`Failed to generate suggestions: ${error.message}`);
  } finally {
    isGeneratingSuggestions = false;
  }
}
async function handleStartSuggestion(suggestionText: string) {
  try {
    // First navigate to the appropriate thread or create a new one
    const threadId = await ensureThreadExists(project.id);
    
    // Store the suggestion in the store
    pendingSuggestion.set(suggestionText);
    
    // Navigate to the thread view
    goto(`/projects/${project.id}/threads/${threadId}`);
    
  } catch (error) {
    console.error('Error handling suggestion:', error);
    // Use console.error instead of showToast
    console.error(`Failed to use suggestion: ${error.message}`);
    // Optional: Display a simple alert for the user
    alert(`Could not use this suggestion: ${error.message}`);
  }
}

// Helper function to ensure a thread exists for this project
async function ensureThreadExists(projectId: string): Promise<string> {
  // Check if the project has any threads
  if (project.threads && project.threads.length > 0) {
    return project.threads[0]; // Use the first thread
  }
  
  try {
    // Create a new thread
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `${project.name} - AI Chat`,
        userId: $currentUser.id,
        projectId: projectId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create a new thread');
    }

    const newThread = await response.json();
    
    // Update project's threads array locally
    project = {
      ...project,
      threads: [...(project.threads || []), newThread.id]
    };
    
    return newThread.id;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw new Error(`Could not create thread: ${error.message}`);
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
              {#if $showThreadList}
              {:else}

                  <div class="project-description-container"
                  class:expanded={isExpandedContent}
                  on:click={toggleDescription}
                  >
                  <span class="header-btns">
                    <h3>{$t('dashboard.projectDescription')}</h3>
                    {#if isOwner}
                    <span class='edit-btns'>
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
                  </span>

                    <p 
                    class="project-description" 
                  >
                    {projectDescription}
                  </p>

                  </div>
                  {/if}
                  <div class="project-sidenav">

                    <ProjectCollaborators projectId={$projectStore.currentProjectId}/>

                    <div class="project-details">
                      <h3>{$t('dashboard.projectActivity')}</h3>

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
                    <span class="header-btns">
                      <h3>{$t('dashboard.projectSuggestions')}</h3>
                      {#if isOwner}
                      <span class='edit-btns'>
                        <button class="edit-button generate" 
                        on:click={() => handleProjectSuggestions()}
                        on:mouseenter={() => hoveredGenerate = true}
                        on:mouseleave={() => hoveredGenerate = false}
                        disabled={isGeneratingSuggestions}
                        >
                        <div class="icon" in:fade>
                          {#if isGeneratingSuggestions}
                            <div class="spinner-container">
                              <div class="spinner"></div>
                            </div>
                          {:else}
                            <BrainCircuit/>
                            {#if hoveredGenerate}
                              <span class="tooltip" in:fade>
                                {$t('tooltip.generateHints')}
                              </span>
                            {/if}
                          {/if}
                        </div> 
                        </button>
                      </span>
    
                      {/if}
                    </span>
                    {#if project?.aiSuggestions && project.aiSuggestions.length > 0}
                      {#if isGeneratingSuggestions}
                      <div class="spinner-container">
                        <div class="spinner"></div>
                      </div>
                      {:else}
                      <div class="ai-suggestions">
                        <!-- <h4>{$t('project.aiSuggestions')}</h4> -->
                        <div class="suggestions-list">
                          {#each project.aiSuggestions as suggestion}
                            <span 
                              class="suggestion-item" 
                              on:click={() => handleStartSuggestion(suggestion)}
                              on:keydown={(e) => e.key === 'Enter' && handleStartSuggestion(suggestion)}
                              role="button"
                              tabindex="0"
                            >
                              {suggestion}
                            </span>
                          {/each}
                        </div>
                      </div>
                      {/if}
                    {/if}
                    {#if isExpandedContent}
                    {:else}

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
    height: 100%;
    width: 100%;
    max-width: 1200px;
    position: relative;
    gap: 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    & h3 {
      font-size: 1.5rem;
      margin-left: 1rem;
      padding: 0.5rem 0;

      border-top: 1px solid var(--line-color);
      color: var(--placeholder-color);
      text-align: center;
      &:first-child {
        border-top: 1px solid transparent;
      }
    }
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

        &.header-btns {
          display: flex;
          flex-direction: row;
          width: 90%;
          justify-content: flex-start;
          align-items: center;
          transition: all 0.3s ease;
          & h3 {
            padding: 0.5rem 0;
            text-align: left;
          }
        }

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
    color: var(--tertiary-color) !important;
    background-color: var(--primary-color);
    backdrop-filter: blur(80px);
    border: 1px solid var(--secondary-color);
      font-weight: 100;
      animation: glowy 0.5s 0.5s initial;    
    padding: 4px 8px;
    border-radius: var(--radius-s);
    transition: all 0.2s ease;
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
    justify-content: center;
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
    align-items: center;
    height: auto;
    // background-color: var(--secondary-color);
    width: 100%;
    transition: all 0.3s ease;
    &:hover {
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
    text-align: left;

    & h3.project-name {
    }

  }
  .project-sidenav {
      display: flex;
      flex-direction: column;
        height: 80vh;
        overflow-y: auto;
        overflow-x: hidden;
        max-width: 600px !important;
        width: 100%;
        scrollbar-width: thin;
        scrollbar-color: var(--line-color) transparent;
      }
  .project-description-container {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    position: relative;
    height: 80vh;
    // margin-top: 10rem;
    width: 100%;
    max-width: 800px;
    display: flex;
    overflow-y: auto;
    overflow-x: hidden;   
    border-radius: 2rem;
    transition: all 0.3s ease;

    &.expanded {
      width: 100vw;

      & .project-description {
        font-size: 1.25rem;
        border: 1px solid var(--line-color);
        background: var(--primary-color);
        border-radius: 2rem;

      }
      & .project-sidenav {
        width: 100%;
        height: 100%;
        overflow-y: scroll;
        background-color: red !important;
      }

      position: relative;
    }
    &:hover {
      button.edit-button {
        display: flex;
      }
    }
  }
  .project-description {
    font-size: 0.9rem;
    letter-spacing: 0.1rem;
    text-justify: justify;
    text-align: justify;
    border-radius: 2rem;
    margin-top: 0;
    line-height: 2;
    height: auto;
    width: auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 2rem;
    color: var(--text-color);
    transition: all 0.3s ease;
    white-space: pre-line;
    scrollbar-width: thin;
    scroll-behavior: smooth;
    scrollbar-color: var(--placeholder-color) transparent;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
    
    &:hover {
      background: var(--bg-color);
    }
  }
  
  .project-details {
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    // border-bottom-left-radius: 2rem;
    gap: 0;
    // border-left: 5px solid var(--tertiary-color);
    // border-bottom: 1px solid var(--tertiary-color);
    width: 100%;
    margin-top: 1rem;
    padding-bottom: 1rem;
    border-top: 1px solid var(--line-color);
    border-bottom: 1px solid var(--line-color);
    & h3 {
      text-align: left;
    }

  }
  
  .detail-row {
    display: flex;
    padding: 0 0.5rem;
    margin-left: 1rem;
    margin-right: 1rem;
    letter-spacing: 0.2rem;
    // border-bottom: 1px solid var(--secondary-color);
    justify-content: space-between;
      align-items: center;
    width: auto;
    font-size: 1rem;
    color: var(--placeholder-color);
    height: auto;
    line-height: 2;
    transition: all 0.3s ease;
    &:hover {
      background: var(--primary-color);
    }
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
    height: auto;
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
    position: relative;
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
    color: var(--placeholder-color);
    border: none;
    cursor: pointer;
    width: auto;
    height: 2rem;
    width: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    opacity: 1;
    & .tooltip {
      letter-spacing: 0.2rem;
      font-size: 1rem;
    }
    &:hover {
      background-color: var(--primary-color);
      transform: scale(1.1);
      color: var(--text-color);
      opacity: 1;
      & .tooltip {
          color: var(--text-color);
        }
    }

  }
  .ai-suggestions {
    margin-top: 1rem;
  }
  
  .suggestions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .suggestion-item {
    background-color: var(--primary-color-light);
    color: var(--text-color);
    padding: 0.5rem 0.75rem;
    border-radius: 1rem;
    line-height: 1.5;
    font-size: 1.2rem;
    font-style: italic;
    background: var(--primary-color);
    border: 1px solid var(--secondary-color);

    letter-spacing: 0.1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    user-select: none;
    display: inline-block;
    transition: all 0.3s ease;
    &:hover {
      background-color: var(--line-color);
      color: var(--tertiary-color);
    }
  }
  

  
  .icon {
    position: relative;
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
    .project-container {
    width: 100%;
	}
    .project-tabs-content {
      max-width: 1200px !important;
      height: 100%;
      position: relative;
      gap: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      margin-top: 0;
    }


    .project-description-container {
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    position: relative;
    height: 8vh;
    // margin-top: 10rem;
    width: 100%;
    max-width: 100%;
    margin-top: 0;

    display: flex;
    overflow-y: auto;
    overflow-x: hidden;   
    border-radius: 2rem;
    transition: all 0.3s ease;
    background: var(--bg-gradient-r);


    &.expanded {
      max-height: 60vh !important;
      & .project-description {
        font-size: 1rem;
        margin-top: 0;
        border: 1px solid var(--line-color);
      }

      max-height: auto; 
      height: 100%;
      position: relative;
    }
    &:hover {
      button.edit-button {
        display: flex;
      }
    }
  }
  .project-description {
    font-size: calc(1.2rem - 0.2vmin);
    letter-spacing: 0.1rem;

    
    &:hover {
      background: var(--primary-color);
    }
  }
    
    .current-project {
      display: flex;
      width: 100%;
      margin: 0 !important;
      align-items: center;
      justify-content: center;

    }
    .project-tabs-content {
    width: calc(100% - 2rem) !important;
    gap: 0.5rem;
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
    gap: 0;
    // border-left: 5px solid var(--tertiary-color);
    // border-bottom: 1px solid var(--tertiary-color);


  }
  .detail-row {
    display: flex;
    letter-spacing: 0.2rem;
    border-bottom: 1px solid var(--secondary-color);
    justify-content: space-between;
      align-items: center;
    width: auto;
    font-size: 1.2rem;
    padding: 0.5rem;
    height: auto;
    line-height: 1.5;
  }
  }

  @media (max-width: 767px) {
    .current-project {
      align-items: center;
      width: 100%;
    }
    .project-description-container {
      height: 3rem;
    }
    h3 {
      font-size: 1.2rem !important;
    }
    .project-content {
      margin-top: -0.5rem !important;
    }
    .tabs-navigation.project {
      gap: 0;
      margin-top: 0.5rem !important;
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
  @media (max-width: 450px) {
    
  }

  </style>