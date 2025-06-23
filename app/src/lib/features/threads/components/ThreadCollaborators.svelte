<script lang="ts">
	import { onMount } from 'svelte';
	import { projectStore } from '$lib/stores/projectStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import type { User, Projects, Threads } from '$lib/types/types';
	import { t } from '$lib/stores/translationStore';
	import { Group, Users } from 'lucide-svelte';
	import { fetchTryCatch, isSuccess, clientTryCatch } from '$lib/utils/errorUtils';

	export let threadId: string;
	export let projectId: string | null;

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
		thread = state.threads.find((t) => t.id === threadId) || null;

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
			const foundProject = state.threads.find((p) => p.id === projectId) || null;
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
		if (!threadId) {
			console.error('No thread ID provided');
			errorMessage = 'No thread ID provided';
			return null;
		}

		console.log('Loading thread data for thread ID:', threadId);

		// Try to get from store first
		const storeState = threadsStore.getThreadById(threadId);
		let threadData: Threads | null = null;

		const unsub = storeState.subscribe((value) => {
			threadData = value;
		});
		unsub(); // Unsubscribe immediately after

		if (threadData) {
			console.log('Thread data found in store:', threadData);
			thread = threadData;
			return thread;
		}

		// If not in store, fetch directly from PocketBase using fetchTryCatch
		console.log('Thread not found in store, fetching from PocketBase');

		const result = await fetchTryCatch<Threads>(`/api/threads/${threadId}`);

		if (isSuccess(result)) {
			thread = result.data;
			console.log('Thread data fetched from PocketBase:', thread);
		} else {
			console.error('Error fetching thread from PocketBase:', result.error);
			thread = null;
			errorMessage = 'Failed to fetch thread data.';
			return null;
		}

		if (thread && $currentUser) {
			projectId = thread.project_id;
			isThreadOwner = thread.user === $currentUser.id;
			console.log('Current user is thread owner:', isThreadOwner);
		}

		return thread;
	}

async function loadProjectData() {
	if (!projectId) {
		console.log('No project ID available');
		return null;
	}

	console.log('Loading project data for project ID:', projectId);

	// Attempt to get project from store first
	const storeState = $projectStore;
	const projectFromStore = storeState.threads.find((p) => p.id === projectId);

	if (projectFromStore) {
		project = projectFromStore;
		console.log('Project data found in store:', project);
	} else {
		// Fetch via API with fetchTryCatch
		const result = await fetchTryCatch<Projects>(`/api/projects/${projectId}`);
		if (isSuccess(result)) {
			project = result.data;
			console.log('Project data loaded via API:', project);
		} else {
			console.error('Error fetching project via API:', result.error);
			project = null;
		}
	}

	if (project && $currentUser) {
		isProjectOwner = project.owner === $currentUser.id;
		console.log('Current user is project owner:', isProjectOwner);

		const collaborators = project.collaborators || [];
		isProjectCollaborator = collaborators.includes($currentUser.id);
		console.log('Current user is project collaborator:', isProjectCollaborator);
	}

	return project;
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
	if (!projectId) {
		console.log('Cannot load project collaborators: No project ID');
		return [];
	}

	errorMessage = '';
	console.log('Loading collaborators for project ID:', projectId);

	const result = await clientTryCatch(projectStore.loadCollaborators(projectId));

	if (isSuccess(result) && Array.isArray(result.data)) {
		projectCollaborators = result.data;
		console.log('Set project collaborators:', projectCollaborators);
	} else {
		console.error('Failed to get project collaborators:', result.error);
		projectCollaborators = [];
	}

	return projectCollaborators;
}

async function loadThreadCollaborators(): Promise<User[]> {
	errorMessage = '';
	console.log('Loading thread collaborators for thread ID:', threadId);

	if (!thread) {
		console.log('Thread data not available, attempting to load it');
		const threadData = await loadThreadData();
		if (!threadData) {
			console.log('Could not load thread data, returning empty collaborators list');
			threadCollaborators = [];
			return [];
		}
	}

	if (!thread) {
		console.log('Thread still not available after loadThreadData');
		threadCollaborators = [];
		return [];
	}

	console.log('Thread data for collaborators:', thread);

	// Extract member IDs from string or array
	let memberIds: string[] = [];

	if (typeof thread.members === 'string' && thread.members.trim() !== '') {
		memberIds = thread.members
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '');
	} else if (Array.isArray(thread.members)) {
		memberIds = thread.members.filter(
			(id): id is string => typeof id === 'string' && id !== ''
		);
	}

	console.log('Processed member IDs:', memberIds);

	if (memberIds.length === 0) {
		console.log('No valid member IDs, returning empty array');
		threadCollaborators = [];
		return [];
	}

	const fetchedUsers: User[] = [];

	for (const userId of memberIds) {
		const result = await fetchTryCatch<{ user?: User; id?: string }>(`/api/users/${userId}`);

		if (isSuccess(result)) {
			const data = result.data;
			if (data.user) {
				fetchedUsers.push(data.user);
			} else if (data.id) {
				// fallback if user data is direct
				fetchedUsers.push(data as User);
			} else {
				console.error(`User data missing expected properties for userId ${userId}`);
			}
		} else {
			console.error(`Failed to fetch user ${userId}:`, result.error);
		}
	}

	console.log('Fetched thread collaborator users:', fetchedUsers);
	threadCollaborators = fetchedUsers;
	return fetchedUsers;
}

	let newCollaboratorName: string = '';

async function findUserByIdentifier(identifier: string): Promise<User | null> {
	if (!$currentUser) {
		console.error('User is not authenticated.');
		return null;
	}

	console.log('Searching for user with identifier:', identifier);
	const sanitizedIdentifier = identifier.trim();

	// Attempt direct ID lookup if it looks like a user ID
	if (sanitizedIdentifier.length >= 15 && !sanitizedIdentifier.includes('@')) {
		console.log('Identifier looks like a user ID, trying direct lookup first...');

		const directResult = await fetchTryCatch<User>(`/api/users/${encodeURIComponent(sanitizedIdentifier)}`);

		if (isSuccess(directResult)) {
			console.log('Found user by direct ID lookup:', directResult.data);
			return directResult.data;
		} else {
			console.log('Direct ID lookup failed:', directResult.error);
		}
	}

	// Use search API endpoint
	console.log('Using search API to find user...');

	const searchResult = await fetchTryCatch<User[]>(`/api/users?search=${encodeURIComponent(sanitizedIdentifier)}`);

	if (!isSuccess(searchResult)) {
		console.error('Failed to search users:', searchResult.error);
		return null;
	}

	const users = searchResult.data;

	console.log('Search API response:', users);

	if (Array.isArray(users) && users.length > 0) {
		// Try exact matches in priority order
		const lowerId = sanitizedIdentifier.toLowerCase();

		const exactEmailMatch = users.find((u) => u.email?.toLowerCase() === lowerId);
		if (exactEmailMatch) return exactEmailMatch;

		const exactUsernameMatch = users.find((u) => u.username?.toLowerCase() === lowerId);
		if (exactUsernameMatch) return exactUsernameMatch;

		const exactNameMatch = users.find((u) => u.name?.toLowerCase() === lowerId);
		if (exactNameMatch) return exactNameMatch;

		// Otherwise, return first user
		return users[0];
	}

	console.log('No users found matching the search criteria');
	return null;
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

	errorMessage = '';
	successMessage = '';
	isLoading = true;

	const user = await findUserByIdentifier(newCollaboratorName);

	if (!user) {
		errorMessage = 'User not found. Please try a different name, email, or ID.';
		isLoading = false;
		return;
	}

	// Check if user is already a collaborator
	const isExistingCollaborator = threadCollaborators.some((c) => c.id === user.id);
	if (isExistingCollaborator) {
		errorMessage = 'This user is already a collaborator.';
		isLoading = false;
		return;
	}

	if (!thread) {
		errorMessage = 'Thread data not available';
		isLoading = false;
		return;
	}

	// Get current members (normalize string or array)
	const currentMembers = Array.isArray(thread.members)
		? thread.members
		: typeof thread.members === 'string' && thread.members.trim() !== ''
		? thread.members.split(',').map((id) => id.trim())
		: [];

	if (currentMembers.includes(user.id)) {
		// Already a member - this case might rarely happen here
		isLoading = false;
		return;
	}

	const updatedMembers = [...currentMembers, user.id];
	console.log('Updated members after adding:', updatedMembers);

	// Update thread members with clientTryCatch
	const updateResult = await clientTryCatch(
		threadsStore.updateThread(threadId, { members: updatedMembers }),
		'Failed to update thread members'
	);

	if (isSuccess(updateResult)) {
		thread = { ...thread, members: updatedMembers };

		// Reload collaborators to update the UI
		await loadThreadCollaborators();

		newCollaboratorName = '';

		const displayName = user.name || user.username || user.email || user.id;
		successMessage = `${displayName} added as collaborator successfully.`;

		setTimeout(() => {
			successMessage = '';
		}, 3000);
	} else {
		errorMessage = updateResult.error;
		console.error('Error updating thread members:', updateResult.error);
	}

	isLoading = false;
}

async function removeCollaborator(userId: string) {
	console.log('Removing collaborator:', userId);

	if (!thread) {
		console.error('Cannot remove collaborator: Thread data not available');
		errorMessage = 'Thread data not available';
		return;
	}

	// Normalize current members to array of strings
	let currentMembers: string[] = [];

	if (typeof thread.members === 'string' && thread.members.trim() !== '') {
		currentMembers = thread.members
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id !== '');
	} else if (Array.isArray(thread.members)) {
		currentMembers = thread.members.filter(
			(id): id is string => typeof id === 'string' && id !== ''
		);
	}

	console.log('Current members before removal:', currentMembers);

	const updatedMembers = currentMembers.filter((id) => id !== userId);
	console.log('Updated members after removal:', updatedMembers);

	const updateResult = await clientTryCatch(
		threadsStore.updateThread(threadId, { members: updatedMembers }),
		'Failed to update thread members'
	);

	if (isSuccess(updateResult)) {
		thread = { ...thread, members: updatedMembers };

		// Store the name before removal for confirmation message
		const removedUser = threadCollaborators.find((c) => c.id === userId);

		await loadThreadCollaborators();

		if (removedUser) {
			const displayName =
				removedUser.name || removedUser.username || removedUser.email || removedUser.id;
			successMessage = `${displayName} removed successfully.`;

			setTimeout(() => {
				successMessage = '';
			}, 3000);
		}
	} else {
		errorMessage = updateResult.error;
		console.error('Failed to remove collaborator:', updateResult.error);
	}
}

async function toggleCollaborator(user: User) {
	if (!thread) {
		console.log('Cannot toggle collaborator: missing thread data');
		errorMessage = 'Thread data not available';
		return;
	}

	errorMessage = '';
	successMessage = '';
	isLoading = true;

	const isAlreadyCollaborator = threadCollaborators.some((c) => c.id === user.id);

	if (isAlreadyCollaborator) {
		if (canRemoveMember(user.id)) {
			const removeResult = await clientTryCatch(removeCollaborator(user.id), 'Failed to remove collaborator');
			if (!isSuccess(removeResult)) {
				errorMessage = removeResult.error;
				console.log('Cannot remove collaborator:', removeResult.error);
			}
		} else {
			errorMessage = "You don't have permission to remove this collaborator";
			console.log('Cannot remove collaborator: insufficient permissions');
		}
	} else {
		if (canAddMembers()) {
			let currentMembers: string[] = [];

			if (typeof thread.members === 'string' && thread.members.trim() !== '') {
				currentMembers = thread.members
					.split(',')
					.map((id) => id.trim())
					.filter((id) => id !== '');
			} else if (Array.isArray(thread.members)) {
				currentMembers = thread.members.filter(
					(id): id is string => typeof id === 'string' && id !== ''
				);
			}

			console.log('Current thread members before adding:', currentMembers);

			if (!currentMembers.includes(user.id)) {
				const updatedMembers = [...currentMembers, user.id];
				console.log('Updated members after adding:', updatedMembers);

				const updateResult = await clientTryCatch(
					threadsStore.updateThread(threadId, { members: updatedMembers }),
					'Failed to update thread members'
				);

				if (isSuccess(updateResult)) {
					thread = { ...thread, members: updatedMembers };
					await loadThreadCollaborators();

					const displayName = user.name || user.username || user.email || user.id;
					successMessage = `${displayName} added as collaborator successfully.`;

					setTimeout(() => {
						successMessage = '';
					}, 3000);
				} else {
					errorMessage = updateResult.error;
					console.log('Error updating thread members:', updateResult.error);
				}
			}
		} else {
			errorMessage = "You don't have permission to add collaborators";
			console.log('Cannot add collaborator: insufficient permissions');
		}
	}

	isLoading = false;
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
		console.log('ThreadCollaborators component mounted with threadId:', threadId);

		if (!threadId) {
			console.error('No thread ID provided to component');
			errorMessage = 'No thread ID provided';
			return;
		}

		isLoading = true;

		// First load thread data, then collaborators
		loadThreadData()
			.then(() => {
				console.log('Thread data loaded:', thread);
				return loadThreadCollaborators();
			})
			.then(() => {
				console.log('Thread collaborators loaded:', threadCollaborators);
				isLoading = false;
			})
			.catch((error) => {
				console.error('Error during component initialization:', error);
				errorMessage = 'Failed to initialize component.';
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
				<Users />
				+
			</button>
		</span>
		<div class="add-collaborator-form">
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
								{#if !threadCollaborators.some((c) => c.id === collaborator.id)}
									<div
										class="collaborator-item {canAddMembers() ? 'can-add' : ''}"
										on:click={() => canAddMembers() && toggleCollaborator(collaborator)}
										title={canAddMembers()
											? 'Click to add to thread'
											: "You don't have permission to add collaborators"}
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

										<div class="collaborator-right">
											{#if collaborator.id === project.owner}
												<span class="owner-badge">Owner</span>
											{:else if canAddMembers()}
												<button class="add-btn" on:click|stopPropagation={() => addCollaborator}>
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
	@use 'src/lib/styles/themes.scss' as *;
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
	.user-avatar,
	.default-avatar {
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

	.add-btn,
	.remove-btn {
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
