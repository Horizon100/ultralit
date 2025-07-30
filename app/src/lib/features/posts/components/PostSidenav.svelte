<!-- src/lib/components/PostSidenav.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fly } from 'svelte/transition';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { postStore } from '$lib/stores/postStore';
	import { onMount } from 'svelte';
	import { tagFilterStore, selectedTags, tagCounts } from '$lib/stores/tagFilterStore';
	import {
		attachmentFilterStore,
		selectedAttachmentFilter,
		attachmentFilterOptions,
		type AttachmentFilterType
	} from '$lib/stores/attachmentFilterStore';
	import { filterStatus } from '$lib/stores/combinedFilterStore';
	import { t } from '$lib/stores/translationStore';

	$: selectedTagsList = $selectedTags;
	$: tagCountsList = $tagCounts;
	$: hasSelectedTags = selectedTagsList.length > 0;
	$: currentAttachmentFilter = $selectedAttachmentFilter;
	$: status = $filterStatus;
	$: if ($showSidenav && $postStore.posts.length > 0) {
		console.log('🏷️ Sidenav became visible, updating tag counts...');
		tagFilterStore.updateTagCounts();
	}
	$: if ($postStore.posts && $postStore.posts.length > 0 && !$postStore.loading) {
		console.log('🏷️ Posts loaded, updating tag counts...');
		console.log('🏷️ Posts count:', $postStore.posts.length);
		console.log(
			'🏷️ Sample posts with tags:',
			$postStore.posts.slice(0, 5).map((p) => ({
				id: p.id,
				tags: p.tags,
				tagCount: p.tagCount
			}))
		);

		tagFilterStore.updateTagCounts();
	}

	onMount(() => {
		console.log('🏷️ PostSidenav mounted');
		console.log('🏷️ Initial posts in store:', $postStore.posts.length);

		console.log('🏷️ Force updating tag counts on mount...');
		tagFilterStore.updateTagCounts();

		if ($postStore.posts.length === 0) {
			console.log('🏷️ No posts loaded yet, setting up retry...');
			let retryCount = 0;
			const maxRetries = 10;

			const retryUpdate = () => {
				retryCount++;
				console.log(`🏷️ Retry ${retryCount}: checking for posts...`);

				if ($postStore.posts.length > 0) {
					console.log('🏷️ Posts found, updating tag counts...');
					tagFilterStore.updateTagCounts();
				} else if (retryCount < maxRetries) {
					setTimeout(retryUpdate, 200);
				} else {
					console.log('🏷️ Max retries reached, giving up');
				}
			};

			setTimeout(retryUpdate, 200);
		}
	});

	function handleTagToggle(tagName: string) {
		console.log('🏷️ Toggling tag:', tagName);
		tagFilterStore.toggleTag(tagName);
	}

	function handleClearTags() {
		console.log('🏷️ Clearing all tags');
		tagFilterStore.clearTags();
	}

	function handleAttachmentFilterChange(filterType: AttachmentFilterType) {
		console.log('📎 Changing attachment filter to:', filterType);
		attachmentFilterStore.setFilter(filterType);
	}

	function handleClearAllFilters() {
		console.log('🔄 Clearing all filters');
		tagFilterStore.clearTags();
		attachmentFilterStore.resetFilter();
	}

	// Get filter counts for attachment types
	$: attachmentFilterCounts =
		$postStore.posts.length > 0 ? attachmentFilterStore.getFilterCounts($postStore.posts) : {};

	// Debug reactive statement
	$: {
		console.log('🏷️ Filter state:', {
			tagCountsList: tagCountsList.length,
			selectedTagsList: selectedTagsList.length,
			postsCount: $postStore.posts.length,
			loading: $postStore.loading,
			attachmentFilter: currentAttachmentFilter,
			hasAnyFilter: status.hasAnyFilter
		});
	}
</script>

{#if $showSidenav}
	<aside class="left-sidebar">
		<div class="sidebar-content">
			<!-- Filter Status Header -->

			<!-- Attachment Filter Section -->
			<div class="filter-section">
				<div class="filter-header">
					<h3>
						<Icon name="Paperclip" size={20} />
						<span>Content Type</span>
					</h3>
					{#if status.hasAnyFilter}
						<div class="filter-status">
							<div class="filter-status-header">
								<!-- <span>Active Filters</span> -->
							</div>
							<button
								class="clear-all-filters-btn"
								on:click={handleClearAllFilters}
								title="Clear all filters"
							>
								<Icon name="X" size={14} />
								<span>{$t('generic.clear')} {$t('generic.all')}</span>
							</button>
						</div>
					{/if}
				</div>

				<div class="filter-container">
					{#each attachmentFilterOptions as option (option.id)}
						{@const count = attachmentFilterCounts[option.id] || 0}
						<button
							class="filter-button"
							class:selected={currentAttachmentFilter === option.id}
							class:disabled={count === 0 && option.id !== 'all'}
							on:click={() => handleAttachmentFilterChange(option.id)}
							disabled={count === 0 && option.id !== 'all'}
							title={option.description}
						>
							<div class="filter-button-content">
								<Icon name="Filter" size={16} />
								<span class="filter-label">{option.label}</span>
							</div>
							<span class="filter-count">{count}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Tags Filter Section -->
			<div class="filter-section">
				<div class="filter-header">
					<h3>
						<Icon name="Tag" size={20} />
						<span>{$t('generic.tags')}</span>
					</h3>

					{#if hasSelectedTags}
						<button
							class="clear-all-filters-btn"
							on:click={handleClearTags}
							title="Clear tag filters"
						>
							<Icon name="X" size={16} />
							<span>{$t('generic.clear')} ({selectedTagsList.length})</span>
						</button>
					{/if}
				</div>

				{#if $postStore.loading}
					<div class="spinner-container">
						<div class="spinner"></div>
					</div>
				{:else if tagCountsList.length > 0}
					<div class="filter-container">
						{#each tagCountsList as { name, count } (name)}
							<button
								class="filter-button"
								class:selected={selectedTagsList.includes(name)}
								on:click={() => handleTagToggle(name)}
								title="Filter posts with '{name}' tag"
							>
								<span class="tag-name">{name}</span>
								<span class="filter-count">{count}</span>
							</button>
						{/each}
					</div>
				{:else if $postStore.posts.length === 0}
					<div class="no-content">
						<Icon name="MessageSquare" size={24} />
						<p>No posts available</p>
						<small>Create some posts to see filters here</small>
					</div>
				{:else}
					<div class="no-content">
						<Icon name="Tag" size={24} />
						<p>No tags found in posts</p>
						<small>Add tags to your posts to filter them</small>
					</div>
				{/if}

				{#if hasSelectedTags}
					<div class="filter-info">
						<!-- <Icon name="Filter" size={14} /> -->
						<span>{$t('status.active')}:</span>
						<span class="tags">
							{selectedTagsList.join(', ')}
						</span>
					</div>
				{/if}
			</div>
		</div>
	</aside>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.left-sidebar {
		width: 100%;
		// max-width: 400px;
		height: auto;
		position: relative;
		background-color: var(--primary-color);
		top: 0;
		bottom: 0;
		left: 0;
		padding-left: 1rem;
		overflow-y: hidden;
		transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		z-index: 1;
	}

	.left-sidebar.drawer-visible {
		left: 4.5rem;
		padding: 1rem;
	}

	.sidebar-content {
		padding: 1rem;
	}

	.sidebar-nav h3 {
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.sidebar-nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.sidebar-nav li {
		margin-bottom: 0.5rem;
	}

	.sidebar-link {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		border-radius: 8px;
		color: var(--text-color);
		text-decoration: none;
		transition: background-color 0.2s ease;
	}

	.sidebar-link:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.sidebar-link span {
		margin-left: 0.75rem;
	}

	.productivity-stats {
		margin-top: 2rem;
		padding: 1rem;
		background: var(--bg-gradient);
		border-radius: 10px;
	}

	.productivity-stats h4 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
	}

	.stat-value {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--primary-color);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-color);
		opacity: 0.8;
	}

	@media (max-width: 1000px) {
		// .left-sidebar {
		// 	height: 80vh;
		// 	width: 100%;
		// 	margin: 2rem;
		// 	border-radius: 0.5rem;
		// 	border-right: none;
		// 	transition: all 0.3s ease;
		// }
	}

	.left-sidebar.drawer-visible {
		left: 0;
		padding: 0;
	}

	.filter-status,
	.filter-header {
		display: flex;
		align-items: center;

		justify-content: space-between;
		margin-top: 1rem;
		border-radius: 8px;
		font-size: 14px;
		& h3 {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			font-size: 1rem;
		}
	}

	.filter-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 0 !important;
		flex: 1;
		color: var(--tertiary-color) !important;
		background: var(--primary-color) !important;
		& span {
			color: var(--text-color);

			&.tags {
				color: var(--tertiary-color);
				font-style: italic;
			}
		}
	}

	.selected-tags {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.selected-tag {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		background: var(--primary-color);
		color: var(--text-color);
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
	}

	.remove-tag {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		opacity: 0.8;
	}

	.remove-tag:hover {
		opacity: 1;
	}

	.clear-all-filters-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		background: var(--primary-color);
		color: var(--placeholder-color);
		border: 1px solid var(--primary-color, #3b82f6);
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.clear-all-filters-btn:hover {
		color: red;
	}

	/* Sidebar Tag Styles */
	.tags-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
	}

	.tags-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.tags-header h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-color);
	}

	.filter-container {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 0.5rem;
		max-height: 90vh;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}
	.filter-button-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
	}

	.filter-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		color: var(--placeholder-color);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: auto;
	}

	.filter-button:hover {
		background: var(--primary-color);
		border-color: var(--line-color);
		color: var(--text-color);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.filter-button.selected {
		background: var(--primary-color);

		color: var(--tertiary-color);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.tag-name {
		font-weight: 500;
		font-size: 0.8rem;
		padding: 0 0.25rem;
	}

	.filter-count {
		background: rgba(255, 255, 255, 0.2);
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 600;
		min-width: 20px;
		text-align: center;
	}

	.filter-button:not(.selected) .filter-count {
		background: var(--primary-color, #3b82f6);
		color: white;
	}

	.no-tags {
		text-align: center;
		padding: 40px 20px;
		color: var(--text-secondary, #6b7280);
	}

	.no-tags p {
		margin: 8px 0 4px 0;
		font-weight: 500;
	}

	.no-tags small {
		font-size: 12px;
		opacity: 0.8;
	}

	.filter-info {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--primary-light, #eff6ff);
		border: 1px solid var(--primary-color, #3b82f6);
		border-radius: 6px;
		font-size: 12px;
		color: var(--primary-dark, #1d4ed8);
	}

	/* Empty States */
	.no-filtered-posts,
	.no-posts {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-secondary, #6b7280);
	}

	.no-filtered-posts h3,
	.no-posts h3 {
		margin: 16px 0 8px 0;
		color: var(--text-primary, #1f2937);
	}

	.show-all-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 20px auto 0;
		padding: 10px 20px;
		background: var(--primary-color, #3b82f6);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 500;
		transition: background 0.2s ease;
	}

	.show-all-btn:hover {
		background: var(--primary-dark, #2563eb);
	}

	.end-of-posts {
		text-align: center;
		padding: 20px;
		color: var(--text-secondary, #6b7280);
	}

	@media (max-width: 768px) {
		.filter-container {
			max-height: 40vh;
		}
		.left-sidebar {
			width: 100%;
			height: 100%;
			margin: 0;
			position: relative;
			overflow-y: auto;
			border-radius: 0.5rem;
			box-shadow:
				rgba(29, 28, 28, 0.5) 10px 10px 10px 10px,
				rgba(29, 28, 28, 0.5) 0px 10px 10px;
			transition: all 0.3s ease;
		}
		.filter-status {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}

		.filter-info {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.selected-tags {
			width: 100%;
		}

		.clear-all-filters-btn {
			align-self: center;
		}
	}
</style>
