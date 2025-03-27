<script lang="ts">
    import { onMount } from 'svelte';
    import { projectStore } from '$lib/stores/projectStore';
    import { pb, currentUser } from '$lib/pocketbase';
    import type { User } from '$lib/types/types';
    export let projectId: string;

    let collaborators: User[] = [];
    let newCollaboratorEmail: string = '';
    let errorMessage: string = '';
  
    onMount(async () => {
        if (projectId) {
        await loadCollaborators();
        }
    });
    async function loadCollaborators() {
        try {
        collaborators = await projectStore.loadCollaborators(projectId);
        } catch (error) {
        console.error('Error loading collaborators:', error);
        errorMessage = 'Failed to load collaborators.';
        }
    }
  
    async function fetchUserByEmail(email: string): Promise<User | null> {
        if (!$currentUser) {
            console.error('User is not authenticated.');
            return null;
        }

        try {
            console.log('Searching for user with email:', email);
            const users = await pb.collection('users').getFullList<User>({
            filter: `email="${email}"`,
            });
            console.log('Users found:', users);
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('Error fetching user by email:', error);
            return null;
        }
    }
    
    async function addCollaborator() {
        if (!$currentUser) {
            errorMessage = 'You must be logged in to add a collaborator.';
            return;
        }

        if (!newCollaboratorEmail) {
            errorMessage = 'Please enter an email address.';
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newCollaboratorEmail)) {
            errorMessage = 'Please enter a valid email address.';
            return;
        }

        try {
            const user = await fetchUserByEmail(newCollaboratorEmail);
            if (user) {
            await projectStore.addCollaborator(projectId, user.id);
            await loadCollaborators(); // Reload the collaborators list
            newCollaboratorEmail = '';
            errorMessage = '';
            } else {
            errorMessage = 'User not found. Please check the email address.';
            }
        } catch (error) {
            errorMessage = 'Failed to add collaborator.';
            console.error(error);
        }
    }
  
    async function removeCollaborator(userId: string) {
      try {
        await projectStore.removeCollaborator(projectId, userId);
        collaborators = await projectStore.loadCollaborators(projectId);
      } catch (error) {
        errorMessage = 'Failed to remove collaborator.';
        console.error(error);
      }
    }
  </script>

  
<div class="collaborators-container">
    <h2>Collaborators</h2>
    {#each collaborators as collaborator}
      <div class="collaborator-item">
        <span>{collaborator.email}</span>
        <button on:click={() => removeCollaborator(collaborator.id)}>Remove</button>
      </div>
    {/each}
    <div class="add-collaborator-form">
      <input type="email" bind:value={newCollaboratorEmail} placeholder="Enter email to add collaborator" />
      <button on:click={addCollaborator}>Add Collaborator</button>
      {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
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
      padding: 2rem;
      background: var(--bg-gradient-right);
      border-radius: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 1rem;

      h2 {
        margin: 0;
        padding: 0;
        letter-spacing: 0.1rem;
      }
    }

    input {
        border-radius: 2rem;
        display: flex;
        flex: 1;
        width: 200px;
        margin-bottom: 1rem;
        color: var(--text-color);
        justify-content: center;
        align-items: center;

    }

    button {
        padding: 1rem;
        border-radius: 2rem;
        display: flex;
        flex: 1;
        width: 200px;
        background: var(--secondary-color);
        border: 1px solid transparent;
        color: var(--text-color);
        justify-content: center;
        align-items: center;

    }
    .collaborator-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin-bottom: 10px;
      background-color: white;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .add-collaborator-form {
      margin-top: 20px;
    }
    .error-message {
      color: red;
      margin-top: 10px;
    }
</style>
