<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { updateTask } from '$lib/clients/taskClient';
  import { currentUser } from '$lib/pocketbase';
  import { projectStore } from '$lib/stores/projectStore';
  import { get } from 'svelte/store';
  import type { User, KanbanColumn } from '$lib/types/types';
	import { User2, UserCheckIcon, Users } from 'lucide-svelte';
  
  export let taskId: string;
  export let assignedTo: string = '';
  export let disabled: boolean = false;
  export let compact: boolean = true;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let projectId: string = '';
interface ApiResponse {
  data?: User[];
  items?: User[];
}
  const dispatch = createEventDispatcher<{
    assigned: { taskId: string; userId: string };
    unassigned: { taskId: string };
  }>();
  let imageLoaded = true; 
  let loading = false;
  let users: User[] = [];
  let showDropdown = false;
  let dropdownRef: HTMLDivElement;
  let canAssign = false;
  let isLoading = true;
  let assignedUserDetails: User | null = null;

async function loadAssignedUserDetails() {
  if (!assignedTo) {
    assignedUserDetails = null;
    return;
  }
  
  try {
    const response = await fetch(`/api/users/${assignedTo}`);
    if (response.ok) {
      assignedUserDetails = await response.json() as User;
    }
  } catch (error) {
    console.error('Failed to load assigned user details:', error);
  }
}

// Watch for assignedTo changes
$: if (assignedTo) {
  loadAssignedUserDetails();
}

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
      
    let apiUsers: User[] = [];
      
if (projectId) {
      // Use the project collaborators API endpoint
      try {
        const result = await projectStore.loadCollaborators(projectId);
        if (Array.isArray(result)) {
          apiUsers = result;
        } else if (result && typeof result === 'object') {
          const apiResult = result as ApiResponse;
          if (apiResult.data && Array.isArray(apiResult.data)) {
            apiUsers = apiResult.data;
          } else if (apiResult.items && Array.isArray(apiResult.items)) {
            apiUsers = apiResult.items;
          }
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
              const ownerUser = await ownerResponse.json() as User;
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
                            const collabUser = await collabResponse.json() as User;
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
  
  // Find assigned user details with safe fallbacks
$: assignedUser = assignedTo && users.length > 0 
  ? users.find(user => user?.id === assignedTo) || null 
  : (assignedUserDetails || null);  
  $: isAssignedToCurrentUser = assignedTo === get(currentUser)?.id;
  
  // Helper function to get user display name safely
  function getUserDisplayName(user: User | null | undefined): string {
    if (!user) return 'User';
    return user.username || user.name || 'User';
  }
  // Helper function to get user initials safely
function getUserInitials(user: User | null | undefined): string {
  if (!user) return 'U';
  const username = user.username || user.name || 'User';
  return username.charAt(0).toUpperCase();
}
  function handleImageError(e: Event) {
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
}

</script>

<svelte:window on:click={handleClickOutside} />
{#if isLoading}
  <div class="loading-container">
    <svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Loading...
  </div>
{:else if canAssign}
  <div class="dropdown-container" bind:this={dropdownRef}>
    {#if compact}
      <button 
        type="button"
        class={`assign-button compact`}
        on:click={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        disabled={disabled || loading}
      >
        {#if loading}
        <div class="loading">
          <div class="loader">
          </div>
        </div>        
    {:else if assignedTo}
          <div class="user-info compact">
            <div class="user-avatar compact">
              <img 
                src={`/api/users/${assignedTo}/avatar`} 
                alt={getUserDisplayName(assignedUser)} 
                on:error={handleImageError}
              />
              <span class="avatar-initials">
                {getUserInitials(assignedUser)}
              </span>
            </div>
            <span class="username">
              {getUserDisplayName(assignedUser)}
            </span>
          </div>
          <button 
            class="unassign-button compact" 
            on:click|stopPropagation={unassignTask}
            disabled={disabled || loading}
          >
            ×
          </button>
        {:else}
          <Users/> 
          <span>
            Assign
          </span>
        {/if}
      </button>
    {:else}
      <button 
        type="button"
        class={`assign-button`}
        on:click={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        disabled={disabled || loading}
      >
        {#if loading}
          <span class="loading-dots">Loading...</span>
        {:else if assignedTo}
          <span class="assigned-label">Assigned to:</span>
<div class="user-info">
  <div class="user-avatar">
    {#if imageLoaded}
      <img 
        src={`/api/users/${assignedTo}/avatar`} 
        alt={getUserDisplayName(assignedUser)} 
        on:error={() => imageLoaded = false}
        on:load={() => imageLoaded = true}
      />
    {:else}
      <span class="avatar-initials">
        {getUserInitials(assignedUser)}
      </span>
    {/if}
  </div>
  <span class="username">
    {getUserDisplayName(assignedUser)}
  </span>
</div>
          <button 
            class="unassign-button" 
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
      <div class="dropdown-menu">
        <div class="dropdown-content">
          {#if users.length === 0}
            <div class="no-users">
              Loading users...
            </div>
          {:else}
            {#each users as user}
              {#if user}
                <button
                  class={`user-option ${user.id === assignedTo ? 'selected' : ''}`}
                  on:click={() => assignTask(user.id)}
                >
                  {getUserDisplayName(user)}
                  {#if user.id === get(currentUser)?.id}
                    <span class="you-label">(you)</span>
                  {/if}
                </button>
              {/if}
            {/each}
            {#if assignedTo}
              <div class="divider"></div>
              <button
                class="unassign-option"
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

<style lang="scss">
  $breakpoint-sm: 576px;
  $breakpoint-md: 1000px;
  $breakpoint-lg: 992px;
  $breakpoint-xl: 1200px;
  @use "src/styles/themes.scss" as *;
  
  * {
    font-family: var(--font-family);
  }

  .loading-container {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--placeholder-color);
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
    margin-left: -0.25rem;
    margin-right: 0.5rem;
    height: 1rem;
    width: 1rem;
    color: var(--placeholder-color);
  }

  .spinner-circle {
    opacity: 0.25;
  }

  .spinner-path {
    opacity: 0.75;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .loading-dots {
    animation: pulse 1.5s linear infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .dropdown-container {
    position: relative;
  }

  .assign-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    border: 1px solid transparent;
    background-color: transparent;
    align-items: center;
    color: var(--text-color);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    gap: 0.5rem;
    transition: all 0.2s ease;
    user-select: none;
    & span {
      display: none;
    }

    &:hover:not(:disabled) {
    background: var(--bg-color);
    border: 1px solid var(--line-color);
        & span {
      display: flex;
    }
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.compact {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  }

  .unassign-button {
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    transition: color 0.2s ease;
    user-select: none;

    &:hover:not(:disabled) {
      color: #b91c1c;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.compact {
      margin-left: 0.25rem;
    }

    &:not(.compact) {
      margin-left: 0.5rem;
    }
  }

  .dropdown-menu {
    position: absolute;
    z-index: 50;
    margin-top: 0.25rem;
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    background: var(--bg-color);
    border: 1px solid var(--line-color);
    max-height: 14rem;
    overflow-y: auto;
    min-width: 7.5rem;
    width: max-content;
    left: 0;
  }

  .dropdown-content {
    padding: 0.25rem 0;
  }

  .no-users {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--placeholder-color);
  }

  .user-option {
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    transition: background-color 0.2s ease;

    &:hover {
      background: var(--bg-gradient);
    }

    &.selected {
      background: var(--primary-color);
      color: white;
    }
  }

  .you-label {
    margin-left: 0.25rem;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .divider {
    border-top: 1px solid var(--line-color);
    margin: 0.25rem 0;
  }

  .user-info {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }
  .unassign-option {
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: #dc2626;
    background: none;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: var(--bg-gradient);
    }
  }
  .user-avatar {
    width: 3;
    height: 3rem;
    border-radius: 50%;
    overflow: hidden;
    background: var(--secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;

    &.compact {
      width: 2rem;
      height: 2rem;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

		  .loading {

    gap: 0;
    width: auto !important;

    & span {
      display: none;
      width: auto !important;
      display: flex;
      line-height: 1.5;
      font-size: 0.8rem;
      animation: pulsate-color 5s infinite;

    }
  }

.loader {
  width: 2rem;
  height: 0.5rem;
  border: 1px solid;
  box-sizing: border-box;
  border-radius: 50%;
  display: grid;
  color: var(--tertiary-color);
  box-shadow: 0px 0px 16px 0px rgba(251, 245, 245, 0.9);
  animation: l2 5s infinite linear;
}
</style>