<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore, getProjectStore } from '$lib/stores/projectStore';
  import { pb, currentUser } from '$lib/pocketbase';
  import type { User, Projects } from '$lib/types/types';
	import { PlusSquareIcon, Trash2, Users } from 'lucide-svelte';
  
  export let projectId: string;

  let collaborators: User[] = [];
  let newCollaboratorEmail: string = '';
  let errorMessage: string = '';
  let successMessage: string = '';
  let project: Projects | null = null;
  let isOwner: boolean = false;
  let isLoading: boolean = false;
  let currentProjectId: string | null = null;

  projectStore.subscribe((state) => {
      currentProjectId = state.currentProjectId;
      
      if (state.currentProjectId === projectId) {
          project = state.threads.find(p => p.id === projectId) || null;
          
          if (project && $currentUser) {
              isOwner = project.owner === $currentUser.id;
          }
      }
  });


 
  export async function loadProjectData() {
      try {
          const storeState = getProjectStore();
          const projectFromStore = storeState.threads.find(p => p.id === projectId);
          
          if (projectFromStore) {
              project = projectFromStore;
          } else {
              project = await pb.collection('projects').getOne<Projects>(projectId);
          }
          
          if (project && $currentUser) {
              isOwner = project.owner === $currentUser.id;
              console.log('Current user is owner:', isOwner);
          }
      } catch (error) {
          console.error('Error loading project data:', error);
          errorMessage = 'Failed to load project data.';
      }
  }

  async function loadCollaborators() {
  try {
    errorMessage = '';
    console.log('Loading collaborators for project ID:', projectId);
    
    if (!projectId) {
      console.error('ProjectId is invalid:', projectId);
      return [];
    }
    
    const result = await projectStore.loadCollaborators(projectId);
    console.log('Raw collaborators result:', result);
    
    if (Array.isArray(result)) {
      collaborators = result;
      console.log('Collaborators array set with length:', collaborators.length);
    } else {
      console.error('Expected array but got:', typeof result, result);
      collaborators = [];
    }
    
    return collaborators;
  } catch (error) {
    console.error('Error loading collaborators:', error);
    errorMessage = 'Failed to load collaborators: ' + (error instanceof Error ? error.message : String(error));
    collaborators = [];
    return [];
  }
}

async function fetchUserByEmail(email: string): Promise<User | null> {
    if (!$currentUser) {
        console.error('User is not authenticated.');
        return null;
    }

    try {
        console.log('Searching for user with email:', email);
        // Sanitize email input
        const sanitizedEmail = email.trim();
        
        const allUsers = await pb.collection('users').getFullList<User>();
        console.log('Total users fetched for manual check:', allUsers.length);
        console.log('All users:', allUsers.map(u => ({ id: u.id, email: u.email, name: u.name })));
        
        let foundUser = allUsers.find(user => user.email === sanitizedEmail);
        
        if (!foundUser) {
            foundUser = allUsers.find(user => {
                if (!user || !user.email) return false;
                return user.email.toLowerCase() === sanitizedEmail.toLowerCase();
            });
        }
        
        if (!foundUser) {
            foundUser = allUsers.find(user => {
                if (!user || !user.email) return false;
                return user.email.toLowerCase().includes(sanitizedEmail.toLowerCase());
            });
        }
        
        console.log('User found by email search:', foundUser);
        return foundUser || null;
    } catch (error) {
        console.error('Error fetching user by email:', error);
        return null;
    }
}

async function fetchUserByName(name: string): Promise<User | null> {
    if (!$currentUser) {
        console.error('User is not authenticated.');
        return null;
    }

    try {
        console.log('Searching for user with name:', name);
        const sanitizedName = name.trim();
        
        const allUsers = await pb.collection('users').getFullList<User>();
        console.log('Total users fetched for name search:', allUsers.length);
        console.log('All users:', allUsers.map(u => ({ id: u.id, name: u.name })));
        
        let foundUser = allUsers.find(user => user.name === sanitizedName);
        
        if (!foundUser) {
            foundUser = allUsers.find(user => {
                if (!user || !user.name) return false;
                return user.name.toLowerCase() === sanitizedName.toLowerCase();
            });
        }
        
        if (!foundUser) {
            foundUser = allUsers.find(user => {
                if (!user || !user.name) return false;
                return user.name.toLowerCase().includes(sanitizedName.toLowerCase());
            });
        }
        
        console.log('User found by name search:', foundUser);
        return foundUser || null;
    } catch (error) {
        console.error('Error fetching user by name:', error);
        return null;
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
        const sanitizedIdentifier = identifier.trim().toLowerCase();
        
        const allUsers = await pb.collection('users').getFullList<User>();
        console.log('Total users fetched for search:', allUsers.length);
        
        console.log('All users with their properties:', allUsers.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email
        })));
        
        for (const user of allUsers) {
            if (
                // If name exists and matches
                (user.name && user.name.toLowerCase() === sanitizedIdentifier) ||
                // If username exists and matches
                (user.username && user.username.toLowerCase() === sanitizedIdentifier) ||
                // If email exists and matches
                (user.email && user.email.toLowerCase() === sanitizedIdentifier) ||
                // If id matches
                (user.id.toLowerCase() === sanitizedIdentifier)
            ) {
                console.log('Found user match:', user);
                return user;
            }
        }
        
        for (const user of allUsers) {
            if (
                // Partial matches in name
                (user.name && user.name.toLowerCase().includes(sanitizedIdentifier)) ||
                // Partial matches in username
                (user.username && user.username.toLowerCase().includes(sanitizedIdentifier)) ||
                // Partial matches in email
                (user.email && user.email.toLowerCase().includes(sanitizedIdentifier))
            ) {
                console.log('Found user with partial match:', user);
                return user;
            }
        }
        
        console.log('No user found with identifier:', sanitizedIdentifier);
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
            const isExistingCollaborator = collaborators.some(c => c.id === user.id);
            if (isExistingCollaborator) {
                errorMessage = 'This user is already a collaborator.';
                isLoading = false;
                return;
            }
            
            console.log('Found user to add:', user);
            await projectStore.addCollaborator(projectId, user.id);
            await loadCollaborators(); 
            newCollaboratorName = '';
            
            const displayName = user.name || user.username || user.email || user.id;
            successMessage = `${displayName} added as collaborator successfully.`;
            
            setTimeout(() => {
                successMessage = '';
            }, 3000);
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
          errorMessage = '';
          successMessage = '';
          isLoading = true;
          
          if (!project) {
              await loadProjectData();
          }
          
          if (project && project.owner === userId) {
              errorMessage = 'Cannot remove the project owner.';
              isLoading = false;
              return;
          }
          
          const removedUser = collaborators.find(c => c.id === userId);
          
          await projectStore.removeCollaborator(projectId, userId);
          await loadCollaborators();
          
          if (removedUser) {
              successMessage = `${removedUser.email} removed successfully.`;
              setTimeout(() => {
                  successMessage = '';
              }, 3000);
          }
          isLoading = false;
      } catch (error) {
          errorMessage = 'Failed to remove collaborator. Error: ' + (error instanceof Error ? error.message : String(error));
          console.error(error);
          isLoading = false;
      }
  }

  function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          addCollaborator();
      }
  }
  $: if ($projectStore.currentProjectId && !projectId) {
    projectId = $projectStore.currentProjectId;
    loadCollaborators();
  }
  
  onMount(async () => {
    isLoading = true;
    console.log('*** Component mounting... ***');
    console.log('ProjectId at mount time:', projectId);
    
    try {
      // Check if projectId is valid
      if (projectId) {
        console.log('Component mounted, projectId:', projectId);
        await loadCollaborators();

      }
      
      // Log current user status
      console.log('Current user at mount time:', $currentUser?.id);
      
      console.log('After loadProjectData - project:', project?.name);
      isLoading = false;

      // Load threads data if we have a projectId

    } catch (error) {
      console.error('Error in onMount:', error);
    }
  });
</script>
{#if isLoading}
<div class="spinner-container">
    <div class="spinner"></div>
</div>
{:else}
  
<div class="collaborators-container">

  {#if isLoading}
      <!-- <div class="loading">Loading...</div> -->
  {:else if collaborators.length > 0}
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
        <button class="add" on:click={addCollaborator} disabled={isLoading}>
            {#if isLoading}
                <div class="spinner-container">
                    <div class="spinner"></div>
                </div>
            {:else}
            <Users/>
            +
            {/if}
        </button>

    </div>
    
    {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {/if}
    
    {#if successMessage}
        <div class="success-message">{successMessage}</div>
    {/if}
</div>
    <div class="collaborators-list">
      {#each collaborators as collaborator}
      <div class="collaborator-item">
        <div class="collaborator-wrapper">
            {#if collaborator.id === project?.owner}
            <span class="owner-badge">Owner</span>
        {:else if $currentUser && isOwner}
            <span class="member-badge" on:click={() => removeCollaborator(collaborator.id)}>
                Remove
            </span>
        {/if}
            {#if collaborator.avatar}
                <img 
                    src={`${pb.baseUrl}/api/files/${collaborator.collectionId}/${collaborator.id}/${collaborator.avatar}`} 
                    alt="Avatar" 
                    class="user-avatar-project" 
                />
            {:else}
                <div class="default-avatar-project">
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
        
    </div>
        {/each}
  </div>
  {:else}
    <div class="loading">Loading collaborator data...</div>
  {/if}
  

</div>
{/if}

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

  
  .collaborators-container {
    // background: var(--bg-gradient-right);
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: flex-start;
    height: auto;
    flex: 1;
    padding-left: 1rem;
    gap: 0.5rem;
    width: 100%;
    h2 {
        font-size: 1.25rem;
        margin: 0;
        padding: 0;
        letter-spacing: 0.1rem;
    }
}



.collaborators-list {
    width: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: row; 
    position: static;
    top: 0;
    justify-content:flex-start;
    align-items: flex-end;
    gap: 0.5rem;
    margin: 0;
    margin-top: 0;
    padding: 0;
}

.add-collaborator-form {

display: flex;
flex-direction: column;
justify-content: flex-end;
align-items: flex-end;
height: auto;
width: auto;
gap: 0.75rem;
margin-top: 1rem;
margin-bottom: 1rem;
transition: all 0.3s ease;
button.add {
    display: none;
    margin-left: 1rem;
    flex-direction: row;
    justify-content: flex-end;
    align-items: flex-end;
    background: var(--bg-color) !important;
    width: 3rem !important;
    height: 3rem !important;

}

&:hover {
    h2 {
        display: none;
    }

            button.add {
                width: 5rem;
                height: 5rem;
                border-radius: 50%;
                display: flex;
                &.spinner-container {
                    background: transparent !important;
                }
                &.spinner {
                    background: transparent !important;
                }
                &:hover {
                    scale: 1.1;
                    background: var(--tertiary-color) !important;

                }


            }
}


}
.input-group {
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        height: auto;
        width: auto !important;
        background: var(--secondary-color);
        position: relative;
        background: transparent;
        gap: 0.75rem;
        transition: all 0.3s ease;

        button.add {
            color: var(--text-color);
            background: transparent;
            height: auto;
            width: auto;
            display: flex;
            
            border-radius: 4rem;
            justify-content: center;
            align-items: center;
            font-size: 1.5rem;
        }
        &:hover {
                background: tertiary-color ;
            }

        @media (min-width: 640px) {
        }
    }


/* For smaller screens */
@media (max-width: 768px) {
    .collaborator-item {
        width: 100%;
    }
}
    .collaborator-email {
        font-weight: 500;
        color: var(--text-color);
    }




    span.input-span {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        width: auto;
        height: 2rem;
        padding: 0 1rem;
        transition: all 0.3s ease;

    }
    input.toggle {
        border-radius: 1rem;
        border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
        background-color: var(--secondary-color);
        color: var(--text-color);
        // flex: 1;
        margin: 0;
        padding: 1rem;
        display: flex;
        font-size: 1rem;
        letter-spacing: 0.2rem;
        transition: all 0.3s ease;
        

        &:focus {
            // padding: 1rem 0.5rem ;
            outline: none;
            display: flex;
            background: var(--primary-color);
            border-color: var(--primary-color, #6366f1);
            // box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
        }

    }

    button {
      border-radius: 1rem;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
        
        button.add-btn {
          background: transparent !important;
          font-size: 3rem !important;
          font-weight: bold;
          cursor: pointer;
          transition: all ease 0.3s;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          user-select: none;
          transition: all 0.2s ease;


          // gap: var(--spacing-sm);

          & span.icon {
            color: var(--placeholder-color);
            gap: 0.5rem;

            &:hover {
            color: var(--tertiary-color);
          }

          &.active {
            color: var(--tertiary-color);
          }
          }
        
          &:hover {
            color: var(--tertiary-color);
          }
        }
        

    }

    .error-message {
        color: var(--error-color, #ef4444);
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }

    .success-message {
        color: var(--success-color, #10b981);
        font-size: 0.875rem;
        margin-top: 0.5rem;
    }

    .no-collaborators {
        color: var(--text-muted-color, #6b7280);
        font-style: italic;
    }


.collaborator-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: auto;

    height: auto;
    border-radius: 2rem !important;
    cursor: pointer;
    &:hover {
      background: var(--secondary-color) !important;
    }
}


    .collaborator-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: 0.5rem;
        gap: 0;
        border-radius: 5rem;

        &:hover {

            span.member-badge {
            color: var(--placeholder-color);
        }

        }


    }

    
    .collaborator-info {

        letter-spacing: 0.3rem;
        color: var(--text-color);
        margin-top: 0.5rem;
    }
    
    .collaborator-right {
        display: flex;
        align-items: center;
    }


    @media (max-width: 1000px) {
        .user-avatar-project {
            width: 3rem !important;
            height: 3rem !important;
            border-radius: 50%;
            object-fit: cover;

        }

        .default-avatar-project {
            width: 3rem !important;
            height: 3rem !important;
            background-color: var(--primary-color, #6366f1);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            border-radius: 50%;

        }
        // .collaborators-container {
        //     padding-left: 1rem;
        //     padding-bottom: 1rem;
        //     margin: 0;
        //     justify-content: center;
        //     align-items: center;
        //     width:5rem;
        //     gap: 0.5rem;
        //     h2 {
        //         font-size: 1.5rem;
        //     }
        // }
        // .collaborators-list {
        //     position: relative;
        //     align-items: center;
        //     flex-wrap: wrap;
        //     flex-direction: column;
        //     justify-content: flex-end;
        // }
        h2 {
          font-size: 0.8rem;
          padding:0;
          font-size: 2rem;
          text-align: right;
        }
    }
</style>
