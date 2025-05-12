<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { updateTask } from '$lib/clients/taskClient';
  import { currentUser } from '$lib/pocketbase';
  import { projectStore } from '$lib/stores/projectStore';
  import { get } from 'svelte/store';
  import type { User } from '$lib/types/types';
  
  export let taskId: string;
  export let assignedTo: string = '';
  export let disabled: boolean = false;
  export let compact: boolean = true;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let projectId: string = '';
  
  const dispatch = createEventDispatcher<{
    assigned: { taskId: string; userId: string };
    unassigned: { taskId: string };
  }>();
  
  let loading = false;
  let users: User[] = [];
  let showDropdown = false;
  let dropdownRef: HTMLDivElement;
  let canAssign = false;
  let isLoading = true;
  
  const sizeClasses = {
    sm: 'text-xs p-1',
    md: 'text-sm p-2',
    lg: 'text-base p-3'
  };

  onMount(async () => {
    checkPermissions();
  });

  // Subscribe to project store to update permissions when project changes
  projectStore.subscribe(() => {
    checkPermissions();
  });

  async function checkPermissions() {
    isLoading = true;
    
    const user = get(currentUser);
    if (!user) {
      canAssign = false;
      isLoading = false;
      return;
    }

    // If no projectId specified, assume user can assign
    if (!projectId) {
      canAssign = true;
      isLoading = false;
      return;
    }

    try {
      // Get current project data
      const state = get(projectStore);
      const project = state.threads.find(p => p.id === projectId);
      
      if (!project) {
        canAssign = false;
        isLoading = false;
        return;
      }
      
      // User can assign if they're the owner or a collaborator
      canAssign = 
        project.owner === user.id || 
        (Array.isArray(project.collaborators) && project.collaborators.includes(user.id));
      
    } catch (error) {
      console.error('Error checking permissions:', error);
      canAssign = false;
    }
    
    isLoading = false;
  }
  
  async function loadUsers() {
    try {
      if (!canAssign) return;
      
      loading = true;
      
      // Use direct API approach similar to ProjectCollaborators.svelte
      let apiUsers = [];
      
      if (projectId) {
        // Use the project collaborators API endpoint
        try {
          const result = await projectStore.loadCollaborators(projectId);
          if (Array.isArray(result)) {
            apiUsers = result;
          } else if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
            apiUsers = result.data;
          }
          console.log('Loaded collaborators for task assignment:', apiUsers.length);
        } catch (collabError) {
          console.error('Failed to load project collaborators:', collabError);
        }
        
        // If we failed to get collaborators, try a different approach
        if (apiUsers.length === 0) {
          const state = get(projectStore);
          const project = state.threads.find(p => p.id === projectId);
          
          if (project) {
            // Get the owner user
            try {
              const ownerResponse = await fetch(`/api/users/${project.owner}`);
              if (ownerResponse.ok) {
                const ownerUser = await ownerResponse.json();
                apiUsers.push(ownerUser);
              }
            } catch (ownerError) {
              console.error('Failed to load project owner:', ownerError);
            }
            
            // Get collaborators if needed
            if (Array.isArray(project.collaborators) && project.collaborators.length > 0) {
              for (const collabId of project.collaborators) {
                try {
                  const collabResponse = await fetch(`/api/users/${collabId}`);
                  if (collabResponse.ok) {
                    const collabUser = await collabResponse.json();
                    apiUsers.push(collabUser);
                  }
                } catch (collabError) {
                  console.error(`Failed to load collaborator ${collabId}:`, collabError);
                }
              }
            }
          }
        }
      } else {
        // No project ID, get all users
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            apiUsers = data;
          } else if (data && Array.isArray(data.items)) {
            apiUsers = data.items;
          }
        }
      }
      
      // Filter out any null/undefined users
      users = apiUsers.filter(Boolean);
      console.log(`Loaded ${users.length} users for assignment dropdown`);
      
      loading = false;
    } catch (error) {
      console.error('Failed to load users:', error);
      users = [];
      loading = false;
    }
  }
  
  async function assignTask(userId: string) {
    if (!taskId || loading || !canAssign) return;
    
    loading = true;
    try {
      const updatedTask = await updateTask(taskId, { assignedTo: userId });
      assignedTo = userId;
      dispatch('assigned', { taskId, userId });
      showDropdown = false;
    } catch (error) {
      console.error('Failed to assign task:', error);
    } finally {
      loading = false;
    }
  }
  
  async function unassignTask() {
    if (!taskId || !assignedTo || loading || !canAssign) return;
    
    loading = true;
    try {
      const updatedTask = await updateTask(taskId, { assignedTo: '' });
      assignedTo = '';
      dispatch('unassigned', { taskId });
    } catch (error) {
      console.error('Failed to unassign task:', error);
    } finally {
      loading = false;
    }
  }
  
  function toggleDropdown() {
    if (disabled || !canAssign) return;
    
    if (!showDropdown) {
      loadUsers();
    }
    showDropdown = !showDropdown;
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (showDropdown && dropdownRef && !event.composedPath().includes(dropdownRef)) {
      showDropdown = false;
    }
  }
  
  // Find assigned user details
  $: assignedUser = assignedTo && users.length > 0 ? users.find(user => user?.id === assignedTo) : null;
  $: isAssignedToCurrentUser = assignedTo === get(currentUser)?.id;
  $: buttonClass = `relative inline-flex items-center justify-center ${sizeClasses[size]} rounded-md font-medium transition-all 
    ${(disabled || !canAssign) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'} 
    ${assignedTo ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`;
</script>

<svelte:window on:click={handleClickOutside} />

{#if isLoading}
  <div class="inline-flex items-center justify-center px-3 py-1 text-sm font-medium text-gray-500 dark:text-gray-400">
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Loading...
  </div>
{:else if canAssign}
  <div class="relative" bind:this={dropdownRef}>
    {#if compact}
      <button 
        type="button"
        class={buttonClass}
        on:click={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        disabled={disabled || loading}
      >
        {#if loading}
          <span class="animate-pulse">...</span>
        {:else if assignedTo}
          {#if assignedUser?.username}
            {assignedUser.username}
          {:else}
            {assignedTo.slice(0, 6)}...
          {/if}
          <button 
            class="ml-1 text-red-500 hover:text-red-700" 
            on:click|stopPropagation={unassignTask}
            disabled={disabled || loading}
          >
            ×
          </button>
        {:else}
          Assign
        {/if}
      </button>
    {:else}
      <button 
        type="button"
        class={buttonClass}
        on:click={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        disabled={disabled || loading}
      >
        {#if loading}
          <span class="animate-pulse">Loading...</span>
        {:else if assignedTo}
          <span>
            Assigned to: 
            {#if assignedUser?.username}
              {assignedUser.username}
            {:else}
              User
            {/if}
          </span>
          <button 
            class="ml-2 text-red-500 hover:text-red-700" 
            on:click|stopPropagation={unassignTask}
            disabled={disabled || loading}
          >
            Unassign
          </button>
        {:else}
          Assign Task
        {/if}
      </button>
    {/if}
    
    {#if showDropdown}
      <div 
        class="absolute z-50 mt-1 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 max-h-56 overflow-y-auto"
        style="min-width: 120px; width: max-content; right: 0;"
      >
        <div class="py-1">
          {#if users.length === 0}
            <div class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading users...
            </div>
          {:else}
            {#each users as user}
              {#if user}
                <button
                  class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 
                        {user.id === assignedTo ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}"
                  on:click={() => assignTask(user.id)}
                >
                  {user.username || user.name || 'User ' + user.id.slice(0, 6)}
                  {#if user.id === get(currentUser)?.id}
                    <span class="ml-1 text-xs">(you)</span>
                  {/if}
                </button>
              {/if}
            {/each}
            {#if assignedTo}
              <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                on:click={unassignTask}
              >
                Unassign
              </button>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}