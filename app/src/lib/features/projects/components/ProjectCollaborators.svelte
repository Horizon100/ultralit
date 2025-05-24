<script lang="ts">
	import { onMount } from 'svelte';
	import { projectStore } from '$lib/stores/projectStore';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import type { User, Projects } from '$lib/types/types';
	import { PlusSquareIcon, Trash2, Users } from 'lucide-svelte';
	import { t } from '$lib/stores/translationStore';

	export let projectId: string;

	let collaborators: User[] = [];
	let newCollaboratorEmail: string = '';
	let errorMessage: string = '';
	let successMessage: string = '';
	let project: Projects | null = null;
	let isOwner: boolean = false;
	let isLoading: boolean = false;
	let currentProjectId: string | null = null;

	// Subscribe to projectStore for project updates
	const unsubscribe = projectStore.subscribe((state) => {
		currentProjectId = state.currentProjectId;

		if (state.currentProjectId === projectId) {
			project = state.threads.find((p) => p.id === projectId) || null;

			if (project && $currentUser) {
				isOwner = project.owner === $currentUser.id;
			}
		}
	});

	// Clean up subscription on component destroy
	onMount(() => {
		return () => {
			unsubscribe();
		};
	});

	export async function loadProjectData() {
		try {
			const storeState = $projectStore; // Accessing the store state directly
			const projectFromStore = storeState.threads.find((p) => p.id === projectId);

			if (projectFromStore) {
				project = projectFromStore;
			} else {
				// Use API endpoint instead of direct pb access
				const response = await fetch(`/api/projects/${projectId}`);
				if (response.ok) {
					project = await response.json();
				} else {
					throw new Error(`Failed to fetch project: ${response.status}`);
				}
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

			// Check if the result is an object with a data property
			if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
				collaborators = result.data;
				console.log('Collaborators array set with length:', collaborators.length);
			} else if (Array.isArray(result)) {
				collaborators = result;
				console.log('Collaborators array set with length:', collaborators.length);
			} else {
				console.error('Expected array but got:', typeof result, result);
				collaborators = [];
			}

			return collaborators;
		} catch (error) {
			console.error('Error loading collaborators:', error);
			errorMessage =
				'Failed to load collaborators: ' + (error instanceof Error ? error.message : String(error));
			collaborators = [];
			return [];
		}
	}

	/*
	 * Remove these unused functions since we're using the findUserByIdentifier approach
	 * async function fetchUserByEmail(email: string): Promise<User | null> { ... }
	 * async function fetchUserByName(name: string): Promise<User | null> { ... }
	 */

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
						const data = await response.json();
						// Handle the response format properly
						const user = data.user || data;
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
					const exactEmailMatch = users.find(
						(u: User) => u.email && u.email.toLowerCase() === sanitizedIdentifier.toLowerCase()
					);
					if (exactEmailMatch) return exactEmailMatch;

					// Then check for exact matches on username
					const exactUsernameMatch = users.find(
						(u: User) =>
							u.username && u.username.toLowerCase() === sanitizedIdentifier.toLowerCase()
					);
					if (exactUsernameMatch) return exactUsernameMatch;

					// Then check for exact matches on name
					const exactNameMatch = users.find(
						(u: User) => u.name && u.name.toLowerCase() === sanitizedIdentifier.toLowerCase()
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
				const isExistingCollaborator = collaborators.some((c) => c.id === user.id);
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
			errorMessage =
				'Failed to add collaborator. Error: ' +
				(error instanceof Error ? error.message : String(error));
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

			const removedUser = collaborators.find((c) => c.id === userId);

			await projectStore.removeCollaborator(projectId, userId);
			await loadCollaborators();

			if (removedUser) {
				const displayName =
					removedUser.name || removedUser.username || removedUser.email || removedUser.id;
				successMessage = `${displayName} removed successfully.`;
				setTimeout(() => {
					successMessage = '';
				}, 3000);
			}
			isLoading = false;
		} catch (error) {
			errorMessage =
				'Failed to remove collaborator. Error: ' +
				(error instanceof Error ? error.message : String(error));
			console.error(error);
			isLoading = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			addCollaborator();
		}
	}

	// React to changes in projectStore.currentProjectId
	$: if ($projectStore.currentProjectId && projectId !== $projectStore.currentProjectId) {
		projectId = $projectStore.currentProjectId;
		console.log('ProjectId updated to:', projectId);
		loadProjectData();
		loadCollaborators();
	}

	// React to changes in the specific project being viewed
	$: if (projectId && projectId === $projectStore.currentProjectId) {
		// Check if project data changed in the store
		const projectFromStore = $projectStore.threads.find((p) => p.id === projectId);
		if (projectFromStore && project !== projectFromStore) {
			project = projectFromStore;
			if ($currentUser) {
				isOwner = project.owner === $currentUser.id;
			}
			console.log('Project data updated from store');
			// Also reload collaborators when project changes
			loadCollaborators();
		}
	}

	// Watch for projectId prop changes
	$: if (projectId) {
		console.log('ProjectId prop changed to:', projectId);
		isLoading = true;
		loadProjectData()
			.then(() => {
				return loadCollaborators();
			})
			.finally(() => {
				isLoading = false;
			});
	}

	onMount(async () => {
		isLoading = true;
		console.log('*** ProjectCollaborators Component mounting... ***');
		console.log('ProjectId at mount time:', projectId);

		try {
			// Check if projectId is valid
			if (projectId) {
				console.log('Component mounted, projectId:', projectId);
				await loadProjectData();
				await loadCollaborators();
			}

			// Log current user status
			console.log('Current user at mount time:', $currentUser?.id);
			console.log('After loadProjectData - project:', project?.name);
			isLoading = false;
		} catch (error) {
			console.error('Error in onMount:', error);
			isLoading = false;
		}
	});
</script>

<div class="add-collaborator-form">
	<h3>{$t('dashboard.projectCollaborators')}</h3>

	<div class="input-group">
		<span class="input-span">
			<input
				class="toggle"
				type="text"
				bind:value={newCollaboratorName}
				placeholder="Enter username, email, or user ID"
				on:keydown={handleKeyDown}
				disabled={isLoading}
			/>
			<button class="add" on:click={addCollaborator} disabled={isLoading}>
				<Users />
				+
			</button>
		</span>
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
	<div class="collaborators-container">
		{#if isLoading}
			<!-- <div class="loading">Loading...</div> -->
		{:else if collaborators.length > 0}
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
									src={`${pocketbaseUrl}/api/files/${collaborator.collectionId}/${collaborator.id}/${collaborator.avatar}`}
									alt="Avatar"
									class="user-avatar-project"
								/>
							{:else}
								<div class="default-avatar-project">
									{(collaborator.name ||
										collaborator.username ||
										collaborator.email ||
										'?')[0]?.toUpperCase()}
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
	@use "src/lib/styles/themes.scss" as *;	* {
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
		justify-content: flex-start;
		align-items: flex-end;
		gap: 0.5rem;
		margin: 0;
		margin-top: 0;
		padding: 0;
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
	.collaborator-info {
		font-size: 0.7rem;
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
			padding: 0;
			font-size: 2rem;
			text-align: right;
		}
	}
</style>
