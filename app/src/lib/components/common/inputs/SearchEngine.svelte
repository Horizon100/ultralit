<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { Search, ArrowRight, Book, MessageCircle, CheckSquare, Layers } from 'lucide-svelte';
  import { projectStore } from '$lib/stores/projectStore';
  import { threadsStore } from '$lib/stores/threadsStore';
  import { messagesStore } from '$lib/stores/messagesStore';
  import { goto } from '$app/navigation';
  import type { Projects, Threads, Messages, Task } from '$lib/types/types';
  
  export let placeholder = 'Search projects, threads, messages, tasks...';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let isFocused = false; 
  
  let searchQuery = '';
  let searchInput: HTMLInputElement;
  let dropdownContainer: HTMLElement;
  let isExpanded = false;
  let isLoading = false;
  
  // Search results
  let projectResults: Projects[] = [];
  let threadResults: Threads[] = [];
  let messageResults: Messages[] = [];
  let taskResults: Task[] = [];
  
  // Search configuration
  let searchCategories = {
    projects: true,
    threads: true,
    messages: true, // Enable message search
    tasks: false     // Start with false for initial implementation
  };
  
  // Debounce timer
  let searchTimer: NodeJS.Timeout;
  
  $: {
    // Watch for searchQuery changes and debounce search
    if (searchTimer) clearTimeout(searchTimer);
    
    if (searchQuery.trim()) {
      searchTimer = setTimeout(() => {
        searchGlobal();
      }, 300);
    } else {
      clearResults();
    }
  }
  
  async function searchGlobal() {
    if (!searchQuery.trim()) {
      clearResults();
      return;
    }
    
    isLoading = true;
    
    try {
      // Ensure data is loaded before searching
      await Promise.all([
        searchCategories.projects ? loadAndSearchProjects() : Promise.resolve(),
        searchCategories.threads ? loadAndSearchThreads() : Promise.resolve(),
        searchCategories.messages ? loadAndSearchMessages() : Promise.resolve()
      ]);
      
      // Only expand if we have results
      if (hasResults()) {
        isExpanded = true;
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function loadAndSearchProjects() {
    // Ensure projects are loaded
    if ($projectStore.threads.length === 0) {
      await projectStore.loadProjects();
    }
    
    // Search projects
    const allProjects = $projectStore.threads;
    projectResults = allProjects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5); // Limit to 5 results
  }
  
  async function loadAndSearchThreads() {
    // Ensure threads are loaded
    if (!$threadsStore.isThreadsLoaded || $threadsStore.threads.length === 0) {
      await threadsStore.loadThreads();
    }
    
    // Search threads
    const allThreads = $threadsStore.threads;
    threadResults = allThreads.filter(thread =>
      thread.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5); // Limit to 5 results
  }
  
  async function loadAndSearchMessages() {
    try {
      // Get current project context for more relevant results
      const currentProject = get(projectStore);
      const projectId = currentProject.currentProjectId;
      
      // Build search URL with optional project filter
      let searchUrl = `/api/messages/search?q=${encodeURIComponent(searchQuery)}&limit=10`;
      if (projectId) {
        searchUrl += `&project=${projectId}`;
      }
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        messageResults = data.messages || [];
      } else {
        console.error('Failed to search messages via API:', response.statusText);
        // Fallback to searching through current messages in store
        console.log('Falling back to local message search...');
        await searchMessagesLocally();
      }
    } catch (error) {
      console.error('Error searching messages via API:', error);
      // Fallback to searching through current messages in store
      console.log('Falling back to local message search...');
      await searchMessagesLocally();
    }
  }
  
  async function searchMessagesLocally() {
    try {
      // Get current messages from store
      const currentMessages = get(messagesStore);
      const messages = currentMessages.messages || [];
      
      if (messages.length === 0) {
        // If no messages in store, try to load them for current thread
        const currentThread = get(threadsStore);
        if (currentThread.currentThreadId) {
          const fetchedMessages = await messagesStore.fetchMessages(currentThread.currentThreadId);
          messageResults = fetchedMessages.filter(message => 
            message.text?.toLowerCase().includes(searchQuery.toLowerCase())
          ).slice(0, 10);
        } else {
          messageResults = [];
        }
      } else {
        // Search through current messages
        messageResults = messages.filter(message => 
          message.text?.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(message => ({
          ...message,
          threadName: $threadsStore.threads.find(t => t.id === message.thread)?.name || 'Unknown Thread',
          threadId: message.thread
        })).slice(0, 10);
      }
    } catch (error) {
      console.error('Error in local message search:', error);
      messageResults = [];
    }
  }
  
  function clearResults() {
    projectResults = [];
    threadResults = [];
    messageResults = [];
    taskResults = [];
    isExpanded = false;
  }
  
  function handleInputFocus() {
    isFocused = true; 
    if (searchQuery.trim() && hasResults()) {
      isExpanded = true;
    }
  }

  function handleInputBlur() {
    isFocused = false; 
    setTimeout(() => {
      isExpanded = false;
    }, 200);
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      searchQuery = '';
      clearResults();
      searchInput.blur();
    }
  }
  
  function hasResults(): boolean {
    return projectResults.length > 0 || 
           threadResults.length > 0 || 
           messageResults.length > 0 || 
           taskResults.length > 0;
  }
  
  async function handleProjectSelect(project: Projects) {
    console.log('Selected project:', project);
    await projectStore.setCurrentProject(project.id);
    searchQuery = '';
    clearResults();
    searchInput.blur();
    
    // Navigate to dashboard if not already there
    if (!window.location.pathname.includes('dashboard')) {
      goto('/dashboard');
    }
  }
  
  async function handleThreadSelect(thread: Threads) {
    console.log('Selected thread:', thread);
    
    // Use the proper setCurrentThread method
    await threadsStore.setCurrentThread(thread.id);
    
    searchQuery = '';
    clearResults();
    searchInput.blur();
    
    // Navigate to the thread
    if (thread.project_id) {
      // If thread belongs to a project, set that project first
      await projectStore.setCurrentProject(thread.project_id);
      goto(`/chat?threadId=${thread.id}`);
    } else {
      // If thread is unassigned, clear project and navigate
      await projectStore.setCurrentProject(null);
      goto(`/chat?threadId=${thread.id}`);
    }
  }

  async function handleMessageSelect(message: Messages) {
    console.log('Selected message:', message);
    
    // Navigate to the thread containing this message
    if (message.thread) {
      // Set the current thread
      await threadsStore.setCurrentThread(message.thread);
      
      // Find the thread to get project context
      const thread = $threadsStore.threads.find(t => t.id === message.thread);
      
      if (thread?.project_id) {
        // If message's thread belongs to a project, set that project first
        await projectStore.setCurrentProject(thread.project_id);
        goto(`/chat?threadId=${message.thread}&messageId=${message.id}`);
      } else {
        // If thread is unassigned, clear project and navigate
        await projectStore.setCurrentProject(null);
        goto(`/chat?threadId=${message.thread}&messageId=${message.id}`);
      }
    }
    
    searchQuery = '';
    clearResults();
    searchInput.blur();
  }
  
  // Handle outside clicks to close dropdown
  function handleClickOutside(event: MouseEvent) {
    if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
      isExpanded = false;
    }
  }
  
  onMount(() => {
    // Add click outside listener
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div 
  class="search-engine" 
  class:size-small={size === 'small'}
  class:size-medium={size === 'medium'}
  class:size-large={size === 'large'}
>
  <div class="search-input-container" bind:this={dropdownContainer}>
    <div class="input-wrapper" class:expanded={isExpanded}>
      <Search class="search-icon" size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        {placeholder}
        class="search-input"
        on:focus={handleInputFocus}
        on:blur={handleInputBlur}
        on:keydown={handleKeydown}
      />
      {#if isLoading}
        <div class="loading-indicator">
          <div class="spinner"></div>
        </div>
      {/if}
    </div>
    
    {#if isExpanded && hasResults()}
      <div class="search-results" transition:slide={{ duration: 200 }}>
        <div class="results-container">
          
          <!-- Project Results -->
          {#if projectResults.length > 0}
            <div class="result-section">
              <div class="section-header">
                <Book size={16} class="section-icon" />
                <span>Projects</span>
              </div>
              {#each projectResults as project}
                <div 
                  class="result-item"
                  on:click={() => handleProjectSelect(project)}
                  on:keydown={(e) => e.key === 'Enter' && handleProjectSelect(project)}
                  tabindex="0"
                  role="button"
                  transition:fade={{ duration: 150 }}
                >
                  <div class="result-content">
                    <span class="result-title">{project.name}</span>
                    {#if project.description}
                      <span class="result-description">{project.description}</span>
                    {/if}
                  </div>
                  <ArrowRight size={14} class="result-arrow" />
                </div>
              {/each}
            </div>
          {/if}
          
          <!-- Thread Results -->
          {#if threadResults.length > 0}
            <div class="result-section">
              <div class="section-header">
                <MessageCircle size={16} class="section-icon" />
                <span>Threads</span>
              </div>
              {#each threadResults as thread}
                <div 
                  class="result-item"
                  on:click={() => handleThreadSelect(thread)}
                  on:keydown={(e) => e.key === 'Enter' && handleThreadSelect(thread)}
                  tabindex="0"
                  role="button"
                  transition:fade={{ duration: 150 }}
                >
                  <div class="result-content">
                    <span class="result-title">{thread.name}</span>
                    {#if thread.project_id}
                      <span class="result-meta">in project</span>
                    {/if}
                  </div>
                  <ArrowRight size={14} class="result-arrow" />
                </div>
              {/each}
            </div>
          {/if}
          
          <!-- Message Results -->
          {#if messageResults.length > 0}
            <div class="result-section">
              <div class="section-header">
                <MessageCircle size={16} class="section-icon" />
                <span>Messages</span>
              </div>
              {#each messageResults as message}
                <div 
                  class="result-item message-result"
                  on:click={() => handleMessageSelect(message)}
                  on:keydown={(e) => e.key === 'Enter' && handleMessageSelect(message)}
                  tabindex="0"
                  role="button"
                  transition:fade={{ duration: 150 }}
                >
                  <div class="result-content">
                    <span class="result-title">
                      {message.text ? 
                        (message.text.length > 80 ? 
                          message.text.substring(0, 80) + '...' : 
                          message.text
                        ) : 
                        'Empty Message'
                      }
                    </span>
                    <div class="result-meta">
                      <span class="thread-name">in {message.threadName || 'Unknown Thread'}</span>
                      {#if message.userName}
                        <span class="separator">•</span>
                        <span class="user-name">by {message.userName}</span>
                      {/if}
                      {#if message.created}
                        <span class="separator">•</span>
                        <span class="message-date">{new Date(message.created).toLocaleDateString()}</span>
                      {/if}
                    </div>
                  </div>
                  <ArrowRight size={14} class="result-arrow" />
                </div>
              {/each}
            </div>
          {/if}
          
          <!-- Empty state -->
          {#if searchQuery.trim() && !isLoading && !hasResults()}
            <div class="result-section">
              <div class="empty-results">
                <span>No results found for "{searchQuery}"</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .search-engine {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto !important;
    height: 3rem;

    
    &.size-small {
      .search-input {
        padding: 0.5rem 2.5rem 0.5rem 2.5rem;
        font-size: 0.875rem;
      }
      .search-icon {
        left: 0.65rem;
      }
      .loading-indicator {
        right: 0.65rem;
      }
    }
    
    &.size-medium {
      .search-input {
        padding: 0.75rem 2.75rem 0.75rem 2.75rem;
        font-size: 1rem;
        width: 100%;

      }
    }
    
    &.size-large {
      .search-input {
        padding: 0.5rem;
        font-size: 1.125rem;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .search-icon {
        left: 0.85rem;
      }
      .loading-indicator {
        right: 0.85rem;
      }
    }
  }
  
  .search-input-container {
    position: relative;
    width: 100%;
    border-radius: 1rem;
    padding: 0 0.5rem;
    height: 2rem;
    display: flex;

  }
  
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0;
      &.expanded {
        background: var(--bg-color);
    }
    
  }
  
  .search-icon {
    position: relative;
    left: 0.75rem;
    color: var(--placeholder-color);
    pointer-events: none;
    z-index: 2;
  }
  
  .search-input {
    width: auto;
    padding: 0 !important;
    margin-left: 0.5rem;
    // padding: 0.75rem 2.75rem 0.75rem 2.75rem;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-color);
    font-family: var(--font-family);
    transition: all 0.2s ease;
    outline: none;
    background: transparent;
    &::placeholder {
      color: var(--placeholder-color);
    }
    
    &:focus {
    }
  }
  
  .loading-indicator {
    position: absolute;
    right: 0.75rem;
    z-index: 2;
  }
  
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--line-color);
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: var(--bg-color);
    border: 1px solid var(--line-color);
    border-top: none;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 400px;
    width: 600px !important;
    max-height: 600px;
    display: flex;
    align-items: stretch;
    flex-grow: 1;
    overflow-y: auto;
  }
  
  .results-container {
    padding: 0.5rem 0;
    width: 100%;
  }
  
  .result-section {
    & + .result-section {
      border-top: 1px solid var(--line-color);
      margin-top: 0.5rem;
      padding-top: 0.5rem;
    }
  }
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--secondary-color);
    background-color: rgba(var(--primary-color-rgb), 0.05);
  }
  
  .section-icon {
    color: var(--primary-color);
  }
  
  .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    
    &:hover {
      background-color: rgba(var(--primary-color-rgb), 0.05);
    }
  }
  
  .result-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }
  
  .result-title {
    font-weight: 500;
    color: var(--text-color);
    font-size: 0.95rem;
  }
  
  .result-description,
  .result-meta {
    font-size: 0.875rem;
    color: var(--secondary-color);
  }
  
  .result-arrow {
    color: var(--placeholder-color);
    transition: color 0.2s ease;
    flex-shrink: 0;
  }
  
  .result-item:hover .result-arrow {
    color: var(--primary-color);
  }
      @media (max-width: 1000px) {
          .search-results {
            width: 450px !important;
          }
      }
</style>