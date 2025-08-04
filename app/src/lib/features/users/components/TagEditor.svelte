<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import type { Tag, Projects, Task, Threads } from '$lib/types/types';

	// Props
	export let selectedTagId: string | null = null;

	// Local state
	let tags: Tag[] = [];
	let projects: Record<string, Projects> = {};
	let tasks: Record<string, Task> = {};
	let threads: Record<string, Threads> = {};
	let isLoading = true;
	let error: string | null = null;
	let editingTag: Tag | null = null;
	let isColorPickerOpen = false;
	let isSaving = false;
	let searchQuery = '';

	// Create a filtered tags computed value
	$: filteredTags =
		searchQuery.trim() === ''
			? tags
			: tags.filter(
					(tag) =>
						tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
						tag.tagDescription.toLowerCase().includes(searchQuery.toLowerCase())
				);

	// Watch for selectedTagId changes
	$: if (selectedTagId) {
		const selected = tags.find((t) => t.id === selectedTagId);
		if (selected) {
			editTag(selected);
		}
	}

	async function loadTags() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/tags?filter=createdBy');
			if (!response.ok) throw new Error('Failed to fetch tags');

			const responseData = await response.json();

			// Handle your API response format: { success: true, data: { items: [...] } }
			if (responseData.success && responseData.data) {
				// PocketBase returns { items: [], page: 1, perPage: 100, totalItems: 0, totalPages: 1 }
				if (responseData.data.items && Array.isArray(responseData.data.items)) {
					tags = responseData.data.items;
				} else if (Array.isArray(responseData.data)) {
					// In case the API returns the array directly
					tags = responseData.data;
				} else {
					console.warn('Unexpected API response format:', responseData);
					tags = [];
				}
			} else {
				console.warn('API response missing expected structure:', responseData);
				tags = [];
			}

			console.log('Loaded tags:', tags);

			// Preload related entities for the tags
			await preloadRelatedEntities();

			isLoading = false;
		} catch (err) {
			console.error('Error loading tags:', err);
			error = (err as Error).message || 'Failed to load tags';
			tags = []; // Ensure tags is always an array
			isLoading = false;
		}
	}

	// Preload projects, tasks and threads related to tags
	async function preloadRelatedEntities() {
		// Ensure tags is an array before proceeding
		if (!Array.isArray(tags) || tags.length === 0) {
			console.log('No tags to preload entities for');
			return;
		}

		const projectIds = new Set<string>();
		const taskIds = new Set<string>();
		const threadIds = new Set<string>();

		// Collect all unique IDs
		tags.forEach((tag) => {
			// Check if taggedProjects exists and is a string before splitting
			if (tag.taggedProjects && typeof tag.taggedProjects === 'string') {
				tag.taggedProjects.split(',').forEach((id) => {
					if (id.trim()) projectIds.add(id.trim());
				});
			} else if (Array.isArray(tag.taggedProjects)) {
				// If it's already an array (might be the case in PocketBase response)
				tag.taggedProjects.forEach((id) => {
					if (id && typeof id === 'string') projectIds.add(id);
				});
			}

			// Check if taggedTasks exists and is a string before splitting
			if (tag.taggedTasks && typeof tag.taggedTasks === 'string') {
				tag.taggedTasks.split(',').forEach((id) => {
					if (id.trim()) taskIds.add(id.trim());
				});
			} else if (Array.isArray(tag.taggedTasks)) {
				// If it's already an array
				tag.taggedTasks.forEach((id) => {
					if (id && typeof id === 'string') taskIds.add(id);
				});
			}

			// Check if taggedThreads exists and is a string before splitting
			if (tag.taggedThreads && typeof tag.taggedThreads === 'string') {
				tag.taggedThreads.split(',').forEach((id) => {
					if (id.trim()) threadIds.add(id.trim());
				});
			} else if (Array.isArray(tag.taggedThreads)) {
				// If it's already an array
				tag.taggedThreads.forEach((id) => {
					if (id && typeof id === 'string') threadIds.add(id);
				});
			}
		});

		console.log('Preloading entities:', {
			projects: Array.from(projectIds),
			tasks: Array.from(taskIds),
			threads: Array.from(threadIds)
		});

		// Fetch projects
		if (projectIds.size > 0) {
			try {
				const projectsResponse = await fetch(
					`/api/projects/batch?ids=${Array.from(projectIds).join(',')}`
				);
				if (projectsResponse.ok) {
					const projectsData = await projectsResponse.json();
					// Handle your API response format
					const projectItems =
						projectsData.success && projectsData.data?.items
							? projectsData.data.items
							: Array.isArray(projectsData.data)
								? projectsData.data
								: [];

					projectItems.forEach((project: Projects) => {
						projects[project.id] = project;
					});
				}
			} catch (err) {
				console.error('Error loading projects:', err);
			}
		}

		// Fetch tasks
		if (taskIds.size > 0) {
			try {
				const tasksResponse = await fetch(`/api/tasks/batch?ids=${Array.from(taskIds).join(',')}`);
				if (tasksResponse.ok) {
					const tasksData = await tasksResponse.json();
					// Handle your API response format
					const taskItems =
						tasksData.success && tasksData.data?.items
							? tasksData.data.items
							: Array.isArray(tasksData.data)
								? tasksData.data
								: [];

					taskItems.forEach((task: Task) => {
						tasks[task.id] = task;
					});
				}
			} catch (err) {
				console.error('Error loading tasks:', err);
			}
		}

		// Fetch threads
		if (threadIds.size > 0) {
			try {
				const threadsResponse = await fetch(
					`/api/threads/batch?ids=${Array.from(threadIds).join(',')}`
				);
				if (threadsResponse.ok) {
					const threadsData = await threadsResponse.json();
					// Handle your API response format
					const threadItems =
						threadsData.success && threadsData.data?.items
							? threadsData.data.items
							: Array.isArray(threadsData.data)
								? threadsData.data
								: [];

					threadItems.forEach((thread: Threads) => {
						threads[thread.id] = thread;
					});
				}
			} catch (err) {
				console.error('Error loading threads:', err);
			}
		}
	}

	// Start editing a tag
	function editTag(tag: Tag) {
		editingTag = { ...tag };
	}

	// Cancel editing
	function cancelEdit() {
		editingTag = null;
	}

	// Save tag changes
	async function saveTag() {
		if (!editingTag) return;

		isSaving = true;
		error = null;

		try {
			const response = await fetch(`/api/tags/${editingTag.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: editingTag.name,
					color: editingTag.color,
					tagDescription: editingTag.tagDescription
				})
			});

			if (!response.ok) throw new Error('Failed to update tag');

			const updatedTag = await response.json();

			// Update the tag in the list
			tags = tags.map((t) => (t.id === updatedTag.id ? updatedTag : t));

			editingTag = null;
			isSaving = false;
		} catch (err) {
			console.error('Error saving tag:', err);
			error = (err as Error).message || 'Failed to save tag';
			isSaving = false;
		}
	}

	// Delete a tag
	async function deleteTag(tagId: string) {
		if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
			return;
		}

		isSaving = true;
		error = null;

		try {
			const response = await fetch(`/api/tags/${tagId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete tag');

			// Remove the tag from the list
			tags = tags.filter((t) => t.id !== tagId);

			if (editingTag && editingTag.id === tagId) {
				editingTag = null;
			}

			isSaving = false;
		} catch (err) {
			console.error('Error deleting tag:', err);
			error = (err as Error).message || 'Failed to delete tag';
			isSaving = false;
		}
	}

	function createNewTag() {
		if (!$currentUser?.id) {
			console.error('No current user available');
			return;
		}

		editingTag = {
			id: '',
			name: 'New Tag',
			tagDescription: '',
			color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
			createdBy: $currentUser.id,
			selected: false,
			thread_id: [],
			user: $currentUser.id,
			collectionId: '',
			collectionName: '',
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};
	}

	// Save a new tag
	async function saveNewTag() {
		if (!editingTag) return;

		isSaving = true;
		error = null;

		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: editingTag.name,
					color: editingTag.color,
					tagDescription: editingTag.tagDescription,
					createdBy: $currentUser?.id,
					selected: false
				})
			});

			if (!response.ok) throw new Error('Failed to create tag');

			const newTag = await response.json();

			// Add the new tag to the list
			tags = [...tags, newTag];

			editingTag = null;
			isSaving = false;
		} catch (err) {
			console.error('Error creating tag:', err);
			error = (err as Error).message || 'Failed to create tag';
			isSaving = false;
		}
	}

	// Get entity name (project, task, thread)
	function getEntityName(type: 'project' | 'task' | 'thread', id: string): string {
		if (type === 'project' && projects[id]) {
			return projects[id].name;
		} else if (type === 'task' && tasks[id]) {
			return tasks[id].title;
		} else if (type === 'thread' && threads[id]) {
			return threads[id].title || 'Thread ' + id;
		}
		return `${type} ${id}`;
	}

	function parseTaggedEntities(entities: string | string[] | undefined | null): string[] {
		if (!entities) return [];

		if (typeof entities === 'string') {
			return entities.split(',').filter(Boolean);
		}

		if (Array.isArray(entities)) {
			return entities.filter(Boolean);
		}

		return [];
	}
	$: taggedProjectIds = parseTaggedEntities(editingTag?.taggedProjects);
	$: taggedTaskIds = parseTaggedEntities(editingTag?.taggedTasks);
	$: taggedThreadIds = parseTaggedEntities(editingTag?.taggedThreads);

	onMount(async () => {
		await loadTags();
	});
</script>

<div class="tag-editor-container">
	<!-- Header and search -->
	<div class="header">
		<!-- <h2>Tag Manager</h2> -->
		<div class="search-box">
			<input type="text" placeholder="Search tags..." bind:value={searchQuery} />
		</div>
		<button class="create-btn" on:click={createNewTag}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"
				></line></svg
			>
			New Tag
		</button>
	</div>

	<!-- Main content -->
	<div class="content">
		<!-- Tags list -->
		<div class="tags-list">
			{#if isLoading}
				<div class="loading">Loading tags...</div>
			{:else if filteredTags.length === 0}
				<div class="empty">
					{searchQuery
						? 'No tags found matching your search.'
						: 'No tags found. Create your first tag!'}
				</div>
			{:else}
				{#each filteredTags as tag}
					<div
						class="tag-item {editingTag && editingTag.id === tag.id ? 'active' : ''}"
						on:click={() => editTag(tag)}
					>
						<div class="tag-color" style="background-color: {tag.color}"></div>
						<div class="tag-info">
							<div class="tag-name">{tag.name}</div>
							{#if tag.tagDescription}
								<div class="tag-description">{tag.tagDescription}</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Tag editor -->
		<div class="tag-details">
			{#if editingTag}
				<div class="edit-form">
					<div class="form-header">
						<h3>{editingTag.id ? 'Edit Tag' : 'Create New Tag'}</h3>
						<div class="form-actions">
							{#if editingTag.id}
								<button class="delete-btn" on:click={() => editingTag && deleteTag(editingTag.id)}>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
										></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line
											x1="10"
											y1="11"
											x2="10"
											y2="17"
										></line><line x1="14" y1="11" x2="14" y2="17"></line></svg
									>
								</button>
							{/if}
						</div>
					</div>

					<div class="form-row">
						<label for="tag-name">Name</label>
						<input id="tag-name" type="text" bind:value={editingTag.name} placeholder="Tag name" />
					</div>

					<div class="form-row">
						<label for="tag-color">Color</label>
						<div class="color-picker-container">
							<div
								class="color-preview"
								style="background-color: {editingTag.color}"
								on:click={() => (isColorPickerOpen = !isColorPickerOpen)}
							></div>
							{#if isColorPickerOpen}
								<div class="color-picker-dropdown">
									<input
										type="color"
										bind:value={editingTag.color}
										on:change={() => (isColorPickerOpen = false)}
									/>
									<div class="preset-colors">
										{#each ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'] as color}
											<div
												class="preset-color"
												style="background-color: {color}"
												on:click={() => {
													if (editingTag) {
														editingTag.color = color;
														isColorPickerOpen = false;
													}
												}}
											></div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<div class="form-row">
						<label for="tag-description">Description</label>
						<textarea
							id="tag-description"
							bind:value={editingTag.tagDescription}
							placeholder="Tag description"
							rows="3"
						></textarea>
					</div>

					{#if editingTag.id}
						<div class="related-entities">
							<h4>Used in</h4>

							{#if editingTag.taggedProjects}
								<div class="entity-section">
									<h5>Projects</h5>
									<ul class="entity-list">
										{#each parseTaggedEntities(editingTag.taggedProjects) as projectId}
											<li>
												<a href="/projects/{projectId}">
													{getEntityName('project', projectId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if editingTag.taggedTasks}
								<div class="entity-section">
									<h5>Tasks</h5>
									<ul class="entity-list">
										{#each parseTaggedEntities(editingTag.taggedTasks) as taskId}
											<li>
												<a href="/tasks/{taskId}">
													{getEntityName('task', taskId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if editingTag.taggedThreads}
								<div class="entity-section">
									<h5>Threads</h5>
									<ul class="entity-list">
										{#each parseTaggedEntities(editingTag.taggedThreads) as threadId}
											<li>
												<a href="/threads/{threadId}">
													{getEntityName('thread', threadId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if !editingTag.taggedProjects && !editingTag.taggedTasks && !editingTag.taggedThreads}
								<div class="empty-entities">This tag is not used anywhere yet.</div>
							{/if}
						</div>
					{/if}

					{#if editingTag.id}
						<div class="related-entities">
							<h4>Used in</h4>

							{#if taggedProjectIds.length > 0}
								<div class="entity-section">
									<h5>Projects</h5>
									<ul class="entity-list">
										{#each taggedProjectIds as projectId}
											<li>
												<a href="/projects/{projectId}">
													{getEntityName('project', projectId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if taggedTaskIds.length > 0}
								<div class="entity-section">
									<h5>Tasks</h5>
									<ul class="entity-list">
										{#each taggedTaskIds as taskId}
											<li>
												<a href="/tasks/{taskId}">
													{getEntityName('task', taskId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if taggedThreadIds.length > 0}
								<div class="entity-section">
									<h5>Threads</h5>
									<ul class="entity-list">
										{#each taggedThreadIds as threadId}
											<li>
												<a href="/threads/{threadId}">
													{getEntityName('thread', threadId)}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if taggedProjectIds.length === 0 && taggedTaskIds.length === 0 && taggedThreadIds.length === 0}
								<div class="empty-entities">This tag is not used anywhere yet.</div>
							{/if}
						</div>
					{/if}

					<div class="form-actions">
						<button class="cancel-btn" on:click={cancelEdit} disabled={isSaving}>Cancel</button>
						<button
							class="save-btn"
							on:click={editingTag.id ? saveTag : saveNewTag}
							disabled={isSaving || !editingTag.name}
						>
							{isSaving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</div>
			{:else}
				<div class="no-selection">
					<div class="empty-state">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path
								d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
							></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg
						>
						<p>Select a tag to edit or create a new one</p>
						<button class="create-btn" on:click={createNewTag}> Create New Tag </button>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="error-message">
					{error}
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

	.tag-editor-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: transparent;
		border-radius: 8px;
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--line-color);
	}

	.header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--secondary-color);
		flex: 1;
	}

	.search-box {
		margin-right: 16px;
	}

	.search-box input {
		padding: 8px 12px;
		border: 1px solid var(--line-color);
		border-radius: 6px;
		font-size: 0.875rem;
		width: 200px;
		background: var(--secondary-color);
	}

	.create-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background-color: var(--secondary-color);
		color: var(--text-color);
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.create-btn:hover {
		background-color: var(--tertiary-color);
	}

	.content {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.tags-list {
		width: 100%;
		height: auto;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--line-color);
		overflow-y: auto;
		margin: 0;

		background-color: transparent;
	}

	.tag-item {
		display: flex;
		align-items: center;
		padding: 1rem;
		height: 3rem;
		border-bottom: 1px solid var(--line-color);
		cursor: pointer;
		width: auto;
		transition: all 0.3s ease-in;
	}

	.tag-item:hover {
		background-color: var(--primary-color);
	}

	.tag-item.active {
		background-color: var(--primary-color);
		border-left: 3px solid var(--tertiary-color);

		& .tag-name {
			color: var(--text-color) !important;
		}
	}

	.tag-color {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		margin-right: 12px;
		flex-shrink: 0;
	}

	.tag-info {
		flex: 1;
		overflow: hidden;
	}

	.tag-name {
		font-weight: 500;
		color: var(--placeholder-color);
		font-size: 1.3rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tag-description {
		font-size: 1rem;
		color: var(--placeholder-color);
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 2px;
	}

	.tag-details {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}

	.edit-form {
		border-radius: 8px;
		padding: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.form-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.form-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.form-row {
		margin-bottom: 16px;
	}

	.form-row label {
		display: block;
		margin-bottom: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-color);
	}

	.form-row input,
	.form-row textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--line-color);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--placeholder-color);
		background: var(--secondary-color);
	}

	.form-row textarea {
		resize: vertical;
	}

	.color-picker-container {
		position: relative;
	}

	.color-preview {
		width: 36px;
		height: 36px;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid var(--line-color);
	}

	.color-picker-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 8px;
		background: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 6px;
		padding: 12px;
		z-index: 10;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.preset-colors {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.preset-color {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
	}

	.cancel-btn {
		padding: 8px 16px;
		background-color: var(--secondary-color);
		color: var(--text-color);
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.cancel-btn:hover {
		background-color: var(--line-color);
	}

	.save-btn {
		padding: 8px 16px;
		background-color: var(--primary-color);
		color: var(--text-color);
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.save-btn:hover {
		background-color: var(--tertiary-color);
	}

	.save-btn:disabled,
	.cancel-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.delete-btn {
		background-color: #ef4444;
		color: var(--text-color);
		border: none;
		border-radius: 6px;
		padding: 6px;
		cursor: pointer;
	}

	.delete-btn:hover {
		background-color: #dc2626;
	}

	.no-selection {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
	}

	.empty-state {
		text-align: center;
		color: #6b7280;
	}

	.empty-state svg {
		color: #d1d5db;
		margin-bottom: 16px;
	}

	.empty-state p {
		margin-bottom: 16px;
	}

	.related-entities {
		margin-top: 24px;
	}

	.related-entities h4 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-color);
		margin-bottom: 12px;
	}

	.entity-section {
		margin-bottom: 16px;
	}

	.entity-section h5 {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-color);
		margin-bottom: 8px;
	}

	.entity-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.entity-list li {
		margin-bottom: 4px;
	}

	.entity-list a {
		color: var(--tertiary-color);
		text-decoration: none;
		font-size: 0.875rem;
	}

	.entity-list a:hover {
		text-decoration: underline;
	}

	.empty-entities {
		font-size: 0.875rem;
		color: var(--placeholder-color);
		font-style: italic;
	}

	.loading,
	.empty {
		padding: 24px;
		text-align: center;
		color: var(--line-color);
	}

	.error-message {
		margin-top: 12px;
		padding: 12px;
		background-color: var(--placeholder-color);
		color: #b91c1c;
		border-radius: 6px;
		font-size: 0.875rem;
	}
</style>
