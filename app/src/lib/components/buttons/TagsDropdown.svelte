<!-- src/lib/components/dropdowns/TagsDropdown.svelte -->
<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { getRandomBrightColor } from '$lib/utils/colorUtils';
	import { currentUser } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { get } from 'svelte/store';
	import { onMount, createEventDispatcher } from 'svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	const dispatch = createEventDispatcher();

	// Props
	export let selectedTags: string[] = [];
	export let currentProjectId: string | null = null;
	export const mode: 'task' | 'thread' = 'task';
	export let isFilterMode: boolean = false;
	export let placeholder: string = 'Tags';
	export let showSelectedCount: boolean = true;
	export let maxHeight: string = '300px';

	// Internal state
	let dropdownContainer: HTMLElement;
	let isExpanded = false;
	let isCreatingTag = false;
	let newTagName = '';
	let searchQuery = '';
	let isLoading = false;
	let error: string | null = null;
	let tags: any[] = [];
	let filteredTags: any[] = [];
	let hoveredTagId: string | null = null;

	// When selectedTags changes, dispatch the event
	$: {
		if (selectedTags) {
			dispatch('tagsChanged', { selectedTags });
		}
	}

	// Filter tags when search query changes
	$: filteredTags = searchQuery
		? tags.filter((tag) => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: tags;

	// Selected tag count for display
	$: selectedCount = selectedTags.length;

	// Selected tag names for display
	$: selectedTagNames = tags.filter((tag) => selectedTags.includes(tag.id)).map((tag) => tag.name);

	// Display text for the dropdown button
	$: displayText =
		selectedTagNames.length > 0
			? selectedTagNames.length > 1
				? `${selectedTagNames[0]} +${selectedTagNames.length - 1}`
				: selectedTagNames[0]
			: placeholder;

	async function loadTags() {
		try {
			isLoading = true;
			error = null;

			let url = '/api/tags';
			if (currentProjectId) {
				url = `/api/projects/${currentProjectId}/tags`;
			}

			const response = await fetch(url);
			if (!response.ok) throw new Error('Failed to fetch tags');

			const data = await response.json();
			tags = data.items || [];

			isLoading = false;
		} catch (err: unknown) {
			console.error('Error loading tags:', err);
			error = err instanceof Error ? err.message : 'Failed to load tags';
			isLoading = false;
		}
	}

	async function saveTag(tag: any) {
		try {
			const tagData: Record<string, any> = {
				name: tag.name,
				tagDescription: tag.tagDescription || '',
				color: tag.color,
				createdBy: get(currentUser)?.id,
				selected: tag.selected || false
			};

			// Update taggedProjects field if we have a current project
			if (currentProjectId) {
				tagData.taggedProjects = currentProjectId;
			}

			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(tagData)
			});

			if (!response.ok) throw new Error('Failed to save tag');

			const savedTag = await response.json();

			// Add the saved tag to our list
			tags = [...tags.filter((t) => t.id !== tag.id), savedTag];

			return savedTag;
		} catch (err: unknown) {
			console.error('Error saving tag:', err);
			error = err instanceof Error ? err.message : 'Failed to save tag';
			throw err;
		}
	}

	async function handleCreateNewTag() {
		if (!newTagName.trim()) return;

		try {
			isCreatingTag = true;

			const tagColor = getRandomBrightColor(newTagName.trim());
			const newTag = {
				id: `local_tag_${Date.now()}`,
				name: newTagName.trim(),
				tagDescription: '',
				color: tagColor,
				createdBy: get(currentUser)?.id,
				selected: false
			};

			// Add to local state immediately for responsiveness
			tags = [...tags, newTag];

			// Save to backend
			const savedTag = await saveTag(newTag);

			// Clear input
			newTagName = '';

			// If in filter mode, automatically select the new tag
			if (isFilterMode) {
				selectedTags = [...selectedTags, savedTag.id];
				dispatch('tagsChanged', { selectedTags });
			}

			isCreatingTag = false;
		} catch (error) {
			console.error('Error creating tag:', error);
			isCreatingTag = false;
		}
	}

	async function handleDeleteTag(e: Event, tagId: string) {
		e.stopPropagation();

		if (!tagId) return;

		try {
			const user = get(currentUser);
			if (!user) throw new Error('User not authenticated');

			const tag = tags.find((t) => t.id === tagId);

			if (!tag) {
				alert('Tag not found');
				return;
			}

			// Only owner can delete
			if (tag.createdBy !== user.id) {
				alert('Only the tag creator can delete this tag.');
				return;
			}

			const confirmed = confirm(
				'Are you sure you want to delete this tag? This action cannot be undone.'
			);
			if (!confirmed) return;

			// Local deletion
			if (tagId.startsWith('local_')) {
				tags = tags.filter((t) => t.id !== tagId);

				// Remove from selected tags if present
				if (selectedTags.includes(tagId)) {
					selectedTags = selectedTags.filter((id) => id !== tagId);
					dispatch('tagsChanged', { selectedTags });
				}

				return;
			}

			// Server deletion
			const response = await fetch(`/api/tags/${tagId}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete tag');

			// Update local state
			tags = tags.filter((t) => t.id !== tagId);

			// Remove from selected tags if present
			if (selectedTags.includes(tagId)) {
				selectedTags = selectedTags.filter((id) => id !== tagId);
				dispatch('tagsChanged', { selectedTags });
			}
		} catch (error) {
			console.error('Error deleting tag:', error);
			alert('Failed to delete tag: ' + (error instanceof Error ? error.message : String(error)));
		}
	}

	function toggleTag(tagId: string) {
		if (selectedTags.includes(tagId)) {
			selectedTags = selectedTags.filter((id) => id !== tagId);
		} else {
			selectedTags = [...selectedTags, tagId];
		}

		dispatch('tagsChanged', { selectedTags });

		// In filter mode, we don't want to close the dropdown after selection
		if (!isFilterMode) {
			isExpanded = false;
		}
	}

	function clearAllTags() {
		selectedTags = [];
		dispatch('tagsChanged', { selectedTags });
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
			isExpanded = false;
			isCreatingTag = false;
		}
	}

	onMount(() => {
		loadTags();
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="dropdown-container" bind:this={dropdownContainer}>
	<span class="dropdown-wrapper">
		<button
			class="dropdown-trigger {isFilterMode ? 'filter-mode' : ''}"
			class:active={selectedTags.length > 0}
			on:click={() => (isExpanded = !isExpanded)}
			disabled={isLoading}
		>
			<!-- <span class="trigger-icon">
        {#if isFilterMode}
          <Filter size={16} />
        {:else}
          <Tag size={16} />
        {/if}
      </span> -->

			<span class="trigger-text">
				{displayText}
				{#if showSelectedCount && selectedTags.length > 0}
					<span class="tag-count">{selectedTags.length}</span>
				{/if}
			</span>

			<span class="dropdown-icon" class:rotated={isExpanded}>
				{@html getIcon('ChevronDown', { size: 16 })}
			</span>
		</button>
	</span>

	{#if isExpanded}
		<div
			class="dropdown-content"
			style="max-height: {maxHeight};"
			transition:slide={{ duration: 200 }}
		>
			<div class="dropdown-header">
				<div class="search-bar">
					<span>
						{@html getIcon('Search', { size: 16 })}
					</span>
					<input type="text" bind:value={searchQuery} placeholder="Search tags" />
				</div>

				<div class="header-actions">
					{#if selectedTags.length > 0}
						<button class="clear-btn" on:click={clearAllTags} title="Clear all selected tags">
							{@html getIcon('X', { size: 14 })}
						</button>
					{/if}

					<button
						class="create-btn"
						on:click={() => (isCreatingTag = !isCreatingTag)}
						disabled={isLoading}
						title="Add new tag"
					>
						{@html getIcon('Plus', { size: 16 })}
					</button>
				</div>
			</div>

			{#if isCreatingTag}
				<div class="create-form" transition:slide>
					<input
						type="text"
						bind:value={newTagName}
						placeholder="Tag name..."
						on:keydown={(e) => {
							if (e.key === 'Enter' && newTagName.trim()) {
								handleCreateNewTag();
							}
						}}
					/>
					<button
						class="create-btn"
						disabled={!newTagName.trim() || isLoading}
						on:click={handleCreateNewTag}
					>
						{@html getIcon('Check', { size: 16 })}
					</button>
				</div>
			{/if}

			<div class="tags-list">
				{#if isLoading}
					<div class="spinner-container">
						<div class="spinner"></div>
					</div>
				{:else if error}
					<div class="error-message">
						<p>{error}</p>
						<button on:click={loadTags}>Retry</button>
					</div>
				{:else if filteredTags.length === 0}
					<div class="empty-state">
						{searchQuery ? 'No tags match your search' : 'No tags found'}
					</div>
				{:else}
					{#each filteredTags as tag (tag.id)}
						<button
							class="tag-item"
							class:active={selectedTags.includes(tag.id)}
							class:disabled={isLoading}
							on:click={() => !isLoading && toggleTag(tag.id)}
							on:mouseenter={() => (hoveredTagId = tag.id)}
							on:mouseleave={() => (hoveredTagId = null)}
							style="--tag-color: {tag.color}"
							aria-pressed={selectedTags.includes(tag.id)}
							disabled={isLoading}
						>
							<span class="tag-color-indicator" style="background-color: {tag.color}"></span>
							<span class="tag-name">{tag.name}</span>

							{#if hoveredTagId === tag.id}
								<div class="tag-actions">
									<button
										class="action-btn delete"
										disabled={isLoading}
										on:click|stopPropagation={(e) => handleDeleteTag(e, tag.id)}
										title="Delete tag"
									>
										{@html getIcon('Trash2', { size: 14 })}
									</button>
								</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.dropdown-container {
		position: relative;
		width: 120px;
	}

	.dropdown-wrapper {
		display: block;
		width: 100%;
	}

	.dropdown-trigger {
		display: flex;
		align-items: center;
		height: 2rem;
		border: 1px solid var(--line-color) !important;
		border-radius: 0;
		border-top-right-radius: 0.5rem;
		border-bottom-right-radius: 0.5rem;
		border-left: 0 !important;
		background-color: var(--primary-color) !important;
		font-size: 0.75rem;
		cursor: pointer;
		width: 100%;
		justify-content: space-between;
		transition: all 0.2s ease;
	}

	.dropdown-trigger:hover {
		border: 1px solid var(--line-color);
		background-color: var(--bg-hover-color, #f7fafc);
	}

	.dropdown-trigger.active {
		border: 1px solid var(--line-color);
		background-color: var(--primary-light, #e0f2fe);
	}

	.dropdown-trigger.filter-mode {
		background-color: var(--filter-bg-color, #f8fafc);
		border: 1px solid var(--line-color);
	}

	.dropdown-trigger.filter-mode.active {
		background-color: var(--filter-active-bg, #f0f9ff);
		border: 1px solid var(--line-color);
	}

	.trigger-icon {
		margin-right: 0.5rem;
		display: flex;
		align-items: center;
		color: var(--placeholder-color);
	}

	.trigger-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
		font-weight: 500;
		color: var(--text-color);
	}

	.dropdown-icon {
		margin-left: 0.5rem;
		transition: transform 0.2s ease;
		color: var(--line-color);
		display: flex;
	}

	.dropdown-icon {
		margin-left: 0.5rem;
		transition: transform 0.2s ease;
	}

	.dropdown-icon.rotated {
		transform: rotate(180deg);
	}

	.tag-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.375rem;
		margin-left: 0.5rem;
		background-color: var(--secondary-color);
		color: white;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.dropdown-content {
		position: absolute;
		top: calc(100% + 0.25rem);
		width: calc(100% + 2rem);
		left: -2rem;
		right: 0;
		background-color: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 0.375rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 30;
		overflow-y: auto;
	}

	.dropdown-header {
		display: flex;
		align-items: center;
		border: 1px solid var(--line-color);
	}

	.search-bar {
		display: flex;
		align-items: center;
		background-color: var(--secondary-color);
		border-radius: 0.25rem;
		padding: 0;
		margin-top: 0;
	}

	.search-bar span {
		display: flex;
		align-items: center;
		color: var(--placeholder-color);
		margin-right: 0.25rem;
	}

	.search-bar input {
		flex: 1;
		border: none;
		background: transparent;
		outline: none;
		font-size: 0.75rem;
		padding: 0.25rem;
		color: var(--text-color);
	}

	.header-actions {
		display: flex;
		align-items: center;
		margin-left: 0.5rem;
	}

	.create-btn,
	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem !important;
		height: 1.5rem !important;

		border-radius: 50% !important;
		border: none;
		background-color: var(--primary-color);
		color: var(--text-color);
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.clear-btn {
		margin-right: 0.25rem;
		color: var(--text-color);
		background-color: var(--secondary-color);
		opacity: 0.5;
		&:hover {
			opacity: 1;
			background-color: red !important;
		}
	}

	.create-btn {
		&:hover {
			background-color: var(--secondary-color);
			color: var(--tertiary-color);
		}
	}

	.create-btn:disabled,
	.clear-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.create-form {
		display: flex;
		padding: 0.5rem;
		background-color: var(--bg-color);
	}

	.create-form input {
		flex: 1;
		border: 1px solid var(--border-color, #e2e8f0);
		border-radius: 0.25rem;
		padding: 0.375rem 0.5rem;
		font-size: 0.875rem;
		outline: none;
		background-color: white;
	}

	.create-form .create-btn {
		margin-left: 0.5rem;
		background-color: var(--primary-color, #3b82f6);
		color: white;
	}

	.create-form .create-btn:hover:not(:disabled) {
		background-color: var(--primary-dark, #2563eb);
	}

	.tags-list {
		padding: 0.25rem;
		gap: 0.5rem;
		display: flex;
		flex-direction: column;
	}

	.tag-item {
		display: flex;
		align-items: center;
		// padding: 0.5rem 0.75rem;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
	}

	.tag-item:hover:not(:disabled) {
		background-color: var(--bg-hover, #f1f5f9);
	}

	.tag-item:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tag-item.active {
		background-color: color-mix(in srgb, var(--tag-color, #3b82f6) 15%, transparent);
	}

	.tag-color-indicator {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 9999px;
		margin-right: 0.5rem;
	}

	.tag-name {
		flex: 1;
		font-size: 0.75rem;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-actions {
		display: flex;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		background-color: transparent;
		color: var(--text-muted, #64748b);
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn.delete:hover {
		background-color: var(--red-50, #fef2f2);
		color: var(--red-500, #ef4444);
	}

	.spinner-container {
		display: flex;
		justify-content: center;
		padding: 1rem;
	}

	.spinner {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid var(--border-color, #e2e8f0);
		border-top-color: var(--primary-color, #3b82f6);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		padding: 0.75rem;
		text-align: center;
		color: var(--red-500, #ef4444);
	}

	.error-message button {
		margin-top: 0.5rem;
		padding: 0.375rem 0.75rem;
		background-color: var(--red-50, #fef2f2);
		color: var(--red-500, #ef4444);
		border: 1px solid var(--red-200, #fecaca);
		border-radius: 0.25rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.empty-state {
		padding: 1rem;
		text-align: center;
		color: var(--text-muted, #64748b);
		font-size: 0.875rem;
	}
</style>
