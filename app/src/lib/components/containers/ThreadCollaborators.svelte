<script lang="ts">
    import { onMount } from 'svelte';
    import { projectStore } from '$lib/stores/projectStore';
    import { threadsStore } from '$lib/stores/threadsStore';
    import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
    import { fade, fly, scale, slide } from 'svelte/transition';
    import type { User, Projects, Threads } from '$lib/types/types';
    import { t } from '$lib/stores/translationStore';
	import { Group, Users } from 'lucide-svelte';

    export let threadId: string;
    export let projectId: string;

    let collaborators: User[] = [];
    let projectCollaborators: User[] = [];
    let threadCollaborators: User[] = [];
    let errorMessage: string = '';
    let successMessage: string = '';
    let project: Projects | null = null;
    let thread: Threads | null = null;
    let isProjectOwner: boolean = false;
    let isThreadOwner: boolean = false;
    let isProjectCollaborator: boolean = false;
    let isLoading: boolean = false;
    let showCollaboratorsList: boolean = false;
    // let projectId: string | null = null;
    let createHovered = false;

    // Subscribe to threadsStore to get updates for thread data
    const unsubThreads = threadsStore.subscribe((state) => {
      thread = state.threads.find(t => t.id === threadId) || null;
      
      if (thread) {
        projectId = thread.project_id;
        
        // Update thread owner status
        if ($currentUser) {
          isThreadOwner = thread.user === $currentUser.id;
        }
      }
    });
  
    // Subscribe to projectStore for project data if we have a projectId
    const unsubProject = projectStore.subscribe((state) => {
      if (projectId && state.threads.length > 0) {
        const foundProject = state.threads.find(p => p.id === projectId) || null;
        if (foundProject) {
          project = foundProject;
          
          // Update project owner status
          if ($currentUser) {
            isProjectOwner = project.owner === $currentUser.id;
            
            // Check if current user is a project collaborator
            const collaborators = project.collaborators || [];
            isProjectCollaborator = collaborators.includes($currentUser.id);
          }
        }
      }
    });
  

    async function loadThreadData() {
      try {
        if (!threadId) {
          console.error("No thread ID provided");
          errorMessage = "No thread ID provided";
          return null;
        }
        
        console.log("Loading thread data for thread ID:", threadId);
        
        // Try to get from store first
        const storeState = threadsStore.getThreadById(threadId);
        let threadData: Threads | null = null;
        
        // Use a subscription to get the current value
        const unsub = storeState.subscribe(value => {
          threadData = value;
        });
        unsub(); // Unsubscribe immediately after
        
        if (threadData) {
          console.log("Thread data found in store:", threadData);
          thread = threadData;
        } else {
          // If not in store, fetch directly from PocketBase
          console.log("Thread not found in store, fetching from PocketBase");
          try {
            const response = await fetch(`/api/threads/${threadId}`);
            if (response.ok) {
              thread = await response.json();
            }            
          console.log("Thread data fetched from PocketBase:", thread);
          } catch (error) {
            console.error("Error fetching thread from PocketBase:", error);
            thread = null;
          }
        }
        
        if (thread) {
          projectId = thread.project_id;
          
          if ($currentUser) {
            isThreadOwner = thread.user === $currentUser.id;
            console.log("Current user is thread owner:", isThreadOwner);
          }
        }
        
        return thread;
      } catch (error) {
        console.error('Error loading thread data:', error);
        errorMessage = 'Failed to load thread data.';
        return null;
      }
    }
  
    async function loadProjectData() {
  try {
    if (!projectId) {
      console.log("No project ID available");
      return null;
    }
    
    console.log("Loading project data for project ID:", projectId);
    
    try {
      // Use the store's state to find the project
      const storeState = $projectStore;
      const projectFromStore = storeState.threads.find(p => p.id === projectId);
      
      if (projectFromStore) {
        project = projectFromStore;
        console.log("Project data found in store:", project);
      } else {
        // If not in store, fetch via API
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          project = await response.json();
          console.log("Project data loaded via API:", project);
        } else {
          console.error("Error fetching project via API:", response.status, response.statusText);
          project = null;
        }
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      project = null;
    }
    
    if (project && $currentUser) {
      isProjectOwner = project.owner === $currentUser.id;
      console.log("Current user is project owner:", isProjectOwner);
      
      // Check if current user is a project collaborator
      const collaborators = project.collaborators || [];
      isProjectCollaborator = collaborators.includes($currentUser.id);
      console.log("Current user is project collaborator:", isProjectCollaborator);
    }
    
    return project;
  } catch (error) {
    console.error('Error loading project data:', error);
    errorMessage = 'Failed to load project data.';
    return null;
  }
}
  
    // Check if the current user can add members to the thread
    function canAddMembers(): boolean {
      if (!$currentUser) return false;
      
      // Anyone who is a project collaborator or project owner can add members
      return isProjectCollaborator || isProjectOwner || isThreadOwner;
    }
    
    // Check if the current user can remove a specific member
    function canRemoveMember(userId: string): boolean {
      if (!$currentUser) return false;
      
      // Project owner can remove anyone
      if (isProjectOwner) return true;
      
      // Users can remove themselves
      if (userId === $currentUser.id) return true;
      
      // Otherwise not allowed
      return false;
    }
  
    async function loadProjectCollaborators() {
      try {
        if (!projectId) {
          console.log("Cannot load project collaborators: No project ID");
          return [];
        }
        
        errorMessage = '';
        console.log('Loading collaborators for project ID:', projectId);
        
        try {
          const result = await projectStore.loadCollaborators(projectId);
          console.log('Project collaborators result:', result);
          
          if (Array.isArray(result)) {
            projectCollaborators = result;
            console.log("Set project collaborators:", projectCollaborators);
          } else {
            console.log("Failed to get project collaborators, using empty array");
            projectCollaborators = [];
          }
        } catch (error) {
          console.error("Error calling projectStore.loadCollaborators:", error);
          projectCollaborators = [];
        }
        
        return projectCollaborators;
      } catch (error) {
        console.error('Error loading project collaborators:', error);
        errorMessage = 'Failed to load project collaborators: ' + (error instanceof Error ? error.message : String(error));
        projectCollaborators = [];
        return [];
      }
    }
  
    async function loadThreadCollaborators() {
    try {
        errorMessage = '';
        console.log('Loading thread collaborators for thread ID:', threadId);
        
        if (!thread) {
            console.log("Thread data not available, attempting to load it");
            const threadData = await loadThreadData();
            if (!threadData) {
                console.log("Could not load thread data, returning empty collaborators list");
                threadCollaborators = [];
                return [];
            }
        }
        
        if (!thread) {
            console.log("Thread still not available after loadThreadData");
            threadCollaborators = [];
            return [];
        }
        
        console.log("Thread data for collaborators:", thread);
        
        // Handle different types of members field
        let memberIds: string[] = [];
        
        if (typeof thread.members === 'string' && thread.members.trim() !== '') {
            // Handle string format (comma-separated values)
            memberIds = thread.members.split(',').map(id => id.trim()).filter(id => id !== '');
        } else if (Array.isArray(thread.members)) {
            // Handle array format
            memberIds = thread.members.filter((id): id is string => typeof id === 'string' && id !== '');
        }
        
        console.log("Processed member IDs:", memberIds);
        
        if (memberIds.length > 0) {
            try {
                // Fetch users one by one instead of batch
                const fetchedUsers: User[] = [];
                
                for (const userId of memberIds) {
                    try {
                        const response = await fetch(`/api/users/${userId}`);
                        if (response.ok) {
                            const data = await response.json();
                            // Access the user data from the nested 'user' property or directly
                            if (data && data.user) {
                                fetchedUsers.push(data.user);
                            } else if (data && data.id) {
                                fetchedUsers.push(data);
                            } else {
                                console.error(`User data missing for ${userId}`);
                            }
                        } else {
                            console.error(`Failed to fetch user ${userId}: ${response.status} ${response.statusText}`);
                        }
                    } catch (error) {
                        console.error(`Error fetching user ${userId}:`, error);
                    }
                }
                
                console.log("Fetched thread collaborator users:", fetchedUsers);
                threadCollaborators = fetchedUsers;
            } catch (error) {
                console.error("Error fetching users for thread members:", error);
                threadCollaborators = [];
            }
        } else {
            console.log("No valid member IDs, using empty array");
            threadCollaborators = [];
        }
        
        return threadCollaborators;
    } catch (error) {
        console.error('Error loading thread collaborators:', error);
        errorMessage = 'Failed to load thread collaborators';
        threadCollaborators = [];
        return [];
    }
}
  
async function toggleCollaborator(user: User) {
    if (!thread) {
        console.log("Cannot toggle collaborator: missing thread data");
        errorMessage = "Thread data not available";
        return;
    }
    
    try {
        errorMessage = '';
        successMessage = '';
        isLoading = true;
        
        const isAlreadyCollaborator = threadCollaborators.some(c => c.id === user.id);
        
        if (isAlreadyCollaborator) {
            // Check if user can remove this collaborator
            if (canRemoveMember(user.id)) {
                await removeCollaborator(user.id);
            } else {
                errorMessage = "You don't have permission to remove this collaborator";
                console.log("Cannot remove collaborator: insufficient permissions");
            }
        } else {
            // Check if user can add collaborators
            if (canAddMembers()) {
                // We already have the user object, so call our internal function
                // Get current members and ensure it's an array
                let currentMembers: string[] = [];
                
                if (typeof thread.members === 'string' && thread.members.trim() !== '') {
                    // Handle string format (comma-separated values)
                    currentMembers = thread.members.split(',').map(id => id.trim()).filter(id => id !== '');
                } else if (Array.isArray(thread.members)) {
                    // Handle array format
                    currentMembers = thread.members.filter((id): id is string => typeof id === 'string' && id !== '');
                }
                
                console.log('Current thread members before adding:', currentMembers);
                
                // Add the new user ID to members if not already present
                if (!currentMembers.includes(user.id)) {
                    const updatedMembers = [...currentMembers, user.id];
                    console.log('Updated members after adding:', updatedMembers);
                    
                    // Update the thread in the database using threadsStore
                    await threadsStore.updateThread(threadId, {
                        members: updatedMembers
                    });
                    
                    // Update local thread data
                    thread = { ...thread, members: updatedMembers };
                    
                    // Reload collaborators to update the UI
                    await loadThreadCollaborators();
                    
                    const displayName = user.name || user.username || user.email || user.id;
                    successMessage = `${displayName} added as collaborator successfully.`;
                    
                    setTimeout(() => {
                        successMessage = '';
                    }, 3000);
                }
            } else {
                errorMessage = "You don't have permission to add collaborators";
                console.log("Cannot add collaborator: insufficient permissions");
            }
        }
        
        isLoading = false;
    } catch (error) {
        errorMessage = 'Failed to update collaborators';
        console.error(error);
        isLoading = false;
    }
}
    let newCollaboratorName: string = '';

    async function findUserByIdentifier(identifier: string): Promise<User | null> {
    if (!$currentUser) {
        console.error('User is not authenticated.');
        return null;
    }

    try {
        console.log('Searching for user with identifier:', identifier);
        const sanitizedIdentifier = identifier.trim();
        
        // First, check if this could be a user ID (typically a string of 15+ characters)
        if (sanitizedIdentifier.length >= 15 && !sanitizedIdentifier.includes('@')) {
            console.log('Identifier looks like a user ID, trying direct lookup first...');
            try {
                const response = await fetch(`/api/users/${encodeURIComponent(sanitizedIdentifier)}`);
                if (response.ok) {
                    const user = await response.json();
                    console.log('Found user by direct ID lookup:', user);
                    return user;
                } else {
                    console.log('Direct ID lookup failed, continuing with search...');
                }
            } catch (error) {
                console.log('Error in direct ID lookup:', error);
                // Continue with search
            }
        }
        
        // Use the search API endpoint
        console.log('Using search API to find user...');
        const response = await fetch(`/api/users?search=${encodeURIComponent(sanitizedIdentifier)}`);
        if (!response.ok) {
            throw new Error(`Failed to search users: ${response.statusText}`);
        }
        
        // The response is an array of users
        const users = await response.json();
        console.log('Search API response:', users);
        
        // Check if we have any users returned
        if (Array.isArray(users) && users.length > 0) {
            console.log('Total users found:', users.length);
            
            // If there are multiple users found, try to find the best match
            if (users.length > 1) {
                // First, check for exact matches on email (most unique identifier)
                const exactEmailMatch = users.find(u => 
                    u.email && u.email.toLowerCase() === sanitizedIdentifier.toLowerCase()
                );
                if (exactEmailMatch) return exactEmailMatch;
                
                // Then check for exact matches on username
                const exactUsernameMatch = users.find(u => 
                    u.username && u.username.toLowerCase() === sanitizedIdentifier.toLowerCase()
                );
                if (exactUsernameMatch) return exactUsernameMatch;
                
                // Then check for exact matches on name
                const exactNameMatch = users.find(u => 
                    u.name && u.name.toLowerCase() === sanitizedIdentifier.toLowerCase()
                );
                if (exactNameMatch) return exactNameMatch;
            }
            
            // Return the first matching user if no exact match was found
            return users[0];
        }
        
        console.log('No users found matching the search criteria');
        return null;
    } catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
}

async function addCollaborator() {
    if (!$currentUser) {
        errorMessage = 'You must be logged in to add a collaborator.';
        return;
    }

    if (!newCollaboratorName) {
        errorMessage = 'Please enter a username, email, or user ID.';
        return;
    }

    try {
        errorMessage = '';
        successMessage = '';
        isLoading = true;
        
        const user = await findUserByIdentifier(newCollaboratorName);
        if (user) {
            // Check if user is already a collaborator
            const isExistingCollaborator = threadCollaborators.some(c => c.id === user.id);
            if (isExistingCollaborator) {
                errorMessage = 'This user is already a collaborator.';
                isLoading = false;
                return;
            }
            
            console.log('Found user to add:', user);
            
            // Update the thread's members list instead of using projectStore
            if (!thread) {
                errorMessage = 'Thread data not available';
                isLoading = false;
                return;
            }
            
            // Get current members and ensure it's an array
            const currentMembers = Array.isArray(thread.members) 
                ? thread.members 
                : (typeof thread.members === 'string' && thread.members.trim() !== '')
                    ? thread.members.split(',')
                    : [];
            
            console.log('Current thread members before adding:', currentMembers);
            
            // Add the new user ID to members if not already present
            if (!currentMembers.includes(user.id)) {
                const updatedMembers = [...currentMembers, user.id];
                console.log('Updated members after adding:', updatedMembers);
                
                // Update the thread in the database using threadsStore
                await threadsStore.updateThread(threadId, {
                    members: updatedMembers
                });
                
                // Update local thread data
                thread = { ...thread, members: updatedMembers };
                
                // Reload collaborators to update the UI
                await loadThreadCollaborators();
                
                newCollaboratorName = '';
                
                const displayName = user.name || user.username || user.email || user.id;
                successMessage = `${displayName} added as collaborator successfully.`;
                
                setTimeout(() => {
                    successMessage = '';
                }, 3000);
            }
        } else {
            errorMessage = 'User not found. Please try a different name, email, or ID.';
        }
        isLoading = false;
    } catch (error) {
        errorMessage = 'Failed to add collaborator. Error: ' + (error instanceof Error ? error.message : String(error));
        console.error(error);
        isLoading = false;
    }
}
  
async function removeCollaborator(userId: string) {
    try {
        console.log("Removing collaborator:", userId);
        
        if (!thread) {
            console.error("Cannot remove collaborator: Thread data not available");
            errorMessage = "Thread data not available";
            return;
        }
        
        // Get current members and ensure it's an array
        let currentMembers: string[] = [];
        
        if (typeof thread.members === 'string' && thread.members.trim() !== '') {
            // Handle string format (comma-separated values)
            currentMembers = thread.members.split(',').map(id => id.trim()).filter(id => id !== '');
        } else if (Array.isArray(thread.members)) {
            // Handle array format
            currentMembers = thread.members.filter((id): id is string => typeof id === 'string' && id !== '');
        }
        
        console.log("Current members before removal:", currentMembers);
        
        // Remove the user
        const updatedMembers = currentMembers.filter(id => id !== userId);
        console.log("Updated members after removal:", updatedMembers);
        
        // Update the thread in the database
        await threadsStore.updateThread(threadId, {
            members: updatedMembers
        });
        
        // Update local thread data
        thread = { ...thread, members: updatedMembers };
        
        // Store the name before removal for confirmation message
        const removedUser = threadCollaborators.find(c => c.id === userId);
        
        // Reload thread collaborators
        await loadThreadCollaborators();
        
        if (removedUser) {
            const displayName = removedUser.name || removedUser.username || removedUser.email || removedUser.id;
            successMessage = `${displayName} removed successfully.`;
            
            setTimeout(() => {
                successMessage = '';
            }, 3000);
        }
    } catch (error) {
        errorMessage = 'Failed to remove collaborator';
        console.error(error);
    }
}
  
    function toggleCollaboratorsList() {
      showCollaboratorsList = !showCollaboratorsList;
      
      if (showCollaboratorsList) {
        console.log("Loading collaborators data");
        
        isLoading = true;
        loadThreadData()
          .then(() => {
            if (thread && thread.project_id) {
              projectId = thread.project_id;
              return loadProjectData();
            }
            return null;
          })
          .then(() => {
            console.log("Project data loaded, loading collaborators");
            const promises = [];
            
            if (projectId) {
              promises.push(loadProjectCollaborators());
            } else {
              console.log("No project ID available, skipping project collaborators");
            }
            
            promises.push(loadThreadCollaborators());
            
            return Promise.all(promises);
          })
          .then(() => {
            console.log("All collaborators loaded");
            console.log("Project collaborators:", projectCollaborators);
            console.log("Thread collaborators:", threadCollaborators);
            isLoading = false;
          })
          .catch(error => {
            console.error("Error loading collaborators data:", error);
            errorMessage = "Failed to load collaborators.";
            isLoading = false;
          });
      }
    }
      function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          addCollaborator();
      }
  }

      // Cleanup subscriptions on component destruction
      onMount(() => {
      return () => {
        unsubThreads();
        unsubProject();
      };
    });
  
    // Initial data loading
    onMount(() => {
      console.log("ThreadCollaborators component mounted with threadId:", threadId);
      
      if (!threadId) {
        console.error("No thread ID provided to component");
        errorMessage = "No thread ID provided";
        return;
      }
      
      isLoading = true;
      
      // First load thread data, then collaborators
      loadThreadData()
        .then(() => {
          console.log("Thread data loaded:", thread);
          return loadThreadCollaborators();
        })
        .then(() => {
          console.log("Thread collaborators loaded:", threadCollaborators);
          isLoading = false;
        })
        .catch(error => {
          console.error("Error during component initialization:", error);
          errorMessage = "Failed to initialize component.";
          isLoading = false;
        });
    });
  </script>

  <div class="collaborators-container">
    
    <!-- <button class="toggle-btn"                     
      on:mouseenter={() => createHovered = true}
      on:mouseleave={() => createHovered = false}
      on:click={toggleCollaboratorsList}>
      {#if createHovered}
        <span class="tooltip" in:fade>
          {$t('threads.shared')}
        </span>
      {/if}

    <Users size="20"/>
        <span class="toggle-text">
          ({threadCollaborators.length})

        </span>
    </button> -->
    
      <div class="collaborators-panel">
        <span class="collaborator-header">
          <h3>{$t('dashboard.projectCollaborators')}</h3>
          <button class="add-collaborator" on:click={addCollaborator} disabled={isLoading}>
        
            <Users/>
            +
        </button>
        </span>
        <div class="add-collaborator-form">
      
          <div class="input-group">
              <span class="input-span">
                  <input class="toggle"
                  type="text" 
                  bind:value={newCollaboratorName} 
                  placeholder="Enter username, email, or user ID" 
                  on:keydown={handleKeyDown}
                  disabled={isLoading}
              />

      
          </div>
          
          {#if errorMessage}
              <div class="error-message">{errorMessage}</div>
          {/if}
          
          {#if successMessage}
              <div class="success-message">{successMessage}</div>
          {/if}
      </div>

        
        {#if isLoading}
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        {:else}
          <div class="collaborators-section">
            
            {#if threadCollaborators.length > 0}
              <div class="collaborators-list">
                {#each threadCollaborators as collaborator}
                  <div class="collaborator-item selected">
                    <div class="collaborator-left">
                      {#if collaborator.avatar}
                        <img 
                          src={`${pocketbaseUrl}/api/files/${collaborator.collectionId}/${collaborator.id}/${collaborator.avatar}`} 
                          alt="Avatar" 
                          class="user-avatar" 
                        />
                      {:else}
                        <div class="default-avatar">
                          {(collaborator.name || collaborator.username || collaborator.email || '?')[0]?.toUpperCase()}
                        </div>
                      {/if}
                      
                      <span class="collaborator-info">
                        {#if collaborator.name}
                          {collaborator.name}
                        {:else if collaborator.username}
                          {collaborator.username}
                        {:else if collaborator.email}
                          {collaborator.email}
                        {:else}
                          User ID: {collaborator.id}
                        {/if}
                      </span>
                    </div>
                    
                      {#if thread && collaborator.id === thread.user}
                        <span class="owner-badge">Owner</span>
                      {:else if canRemoveMember(collaborator.id)}
                        <button 
                          class="remove-btn" 
                          on:click|stopPropagation={() => removeCollaborator(collaborator.id)}
                        >
                          {collaborator.id === $currentUser?.id ? 'Leave' : 'Remove'}
                        </button>
                      {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <p class="no-collaborators">No one has been added to this thread yet.</p>
            {/if}
          </div>
          
          {#if project && projectId}
            <div class="collaborators-section">
              <!-- <h4>Available Project Collaborators</h4> -->
              
              {#if projectCollaborators.length > 0}
                <div class="collaborators-list">
                  {#each projectCollaborators as collaborator}
                    {#if !threadCollaborators.some(c => c.id === collaborator.id)}
                      <div 
                        class="collaborator-item {canAddMembers() ? 'can-add' : ''}"
                        on:click={() => canAddMembers() && toggleCollaborator(collaborator)}
                        title={canAddMembers() ? "Click to add to thread" : "You don't have permission to add collaborators"}
                      >
                        <div class="collaborator-left">
                          {#if collaborator.avatar}
                            <img 
                              src={`${pocketbaseUrl}/api/files/${collaborator.collectionId}/${collaborator.id}/${collaborator.avatar}`} 
                              alt="Avatar" 
                              class="user-avatar" 
                            />
                          {:else}
                            <div class="default-avatar">
                              {(collaborator.name || collaborator.username || collaborator.email || '?')[0]?.toUpperCase()}
                            </div>
                          {/if}
                          
                          <span class="collaborator-info">
                            {#if collaborator.name}
                              {collaborator.name}
                            {:else if collaborator.username}
                              {collaborator.username}
                            {:else if collaborator.email}
                              {collaborator.email}
                            {:else}
                              User ID: {collaborator.id}
                            {/if}
                          </span>
                        </div>
                        
                        <div class="collaborator-right">
                          {#if collaborator.id === project.owner}
                            <span class="owner-badge">Owner</span>
                          {:else if canAddMembers()}
                            <button 
                              class="add-btn" 
                              on:click|stopPropagation={() => addCollaborator(collaborator.id)}
                            >
                              Add
                            </button>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {:else if projectId}
                <p class="no-collaborators">No additional project collaborators available.</p>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
  </div>
  
  <style lang="scss">
    @use 'src/styles/themes.scss' as *;
    * {
      font-family: var(--font-family);
      transition: all 0.3s ease;
    }
  
    .collaborators-container {
      width: calc(100%);
		max-width: 1200px;
		margin-right: 0;
		margin-left: 1rem;
    display: flex;
    justify-content: flex-end;
    }

    .collaborators-panel {
      top: 100%;
      right: 0;
      margin-top: 0.5rem;
      width: 300px;
      height: auto;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      padding: 1rem;
      z-index: 100;
      
      h3 {
        margin-top: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      
      h4 {
        margin-top: 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
      }
    }
  
    .collaborators-section {
      margin-bottom: 1rem;
      margin-top: 1rem;
    }
  
    .collaborators-list {
      max-height: auto;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      flex-wrap: wrap;
      margin-top: 1rem;
      gap: 0.5rem;
    }
  
    .collaborator-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 2rem;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &.can-add:hover {
        background: var(--secondary-color);
      }
      
      &.selected {
        background: var(--secondary-color);
        border-color: var(--primary-color);
      }
    }


    .toggle-btn {
      width: auto;
      padding: 0 !important;
      height: auto;

      & span.toggle-text {
        display: none;
      }
    }
    .collaborator-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    span.collaborator-header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0;
    }
    button {
      border-radius: 1rem;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;

        &.add-collaborator {
          background: var(--bg-color);
          top: 0;
          right: 0;
          &:hover {
            background: var(--secondary-color);
          }
        }


    }

    .spinner-container {
      position: relative;
    }
    .input-group {
      width: 100% !important;

      align-items: flex-start;
      display: flex;
    }
    span.input-span {
      width: 100%;
    }

    input.toggle {
      width: calc(100% - 1rem) !important;
        padding: 0.5rem;
      margin: 0;
      font-size: 0.8rem;
      letter-spacing: 0.05rem;

    }
    .add-collaborator-form {
      flex-direction: column !important;
    }
    .user-avatar, .default-avatar {
      width: 24px !important;
      height: 24px !important;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 600;
      font-size: 0.8rem;
    }
  
    .default-avatar {
      background-color: var(--primary-color);
      color: white;
    }
  
    .collaborator-info {
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }
  
    .collaborator-right {
      display: flex;
      align-items: center;
    }
  

  
    .add-btn, .remove-btn {
      font-size: 0.75rem;
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
  
    .add-btn {
      background-color: var(--success-color);
      color: white;
      
      &:hover {
        background-color: var(--success-hover-color, #0d9488);
      }
    }
  
    .remove-btn {
      background-color: var(--danger-color);
      color: white;
      
      &:hover {
        background-color: var(--danger-hover-color, #dc2626);
      }
    }
  

  
    .error-message {
      color: red;
      font-size: 0.875rem;
      margin: 0.5rem 0;
    }
  
    .success-message {
      color: var(--tertiary-color);
      font-size: 0.875rem;
      margin: 0.5rem 0;
    }
  
    .no-collaborators {
      color: var(--placeholder-color);
      font-style: italic;
      font-size: 0.9rem;
      padding: 0.5rem 0;
    }
    
    @media (max-width: 767px) {

    .toggle-btn {
      width: auto;
      padding: 0 !important;
      height: auto;

      & span.toggle-text {
        display: none;
      }
    }
  }
  </style>