<!-- src/lib/components/PostSidenav.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fly } from 'svelte/transition';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { postStore } from '$lib/stores/postStore';
	import { onMount } from 'svelte';
	import { tagFilterStore, selectedTags, tagCounts } from '$lib/stores/tagFilterStore';

	// Simple reactive statements
	$: selectedTagsList = $selectedTags;
	$: tagCountsList = $tagCounts;
	$: hasSelectedTags = selectedTagsList.length > 0;

	// Watch for posts to be loaded and update tag counts
	$: if ($postStore.posts && $postStore.posts.length > 0 && !$postStore.loading) {
		console.log('🏷️ Posts loaded, updating tag counts...');
		console.log('🏷️ Posts count:', $postStore.posts.length);
		console.log('🏷️ Sample posts with tags:', $postStore.posts.slice(0, 5).map(p => ({ 
			id: p.id, 
			tags: p.tags,
			tagCount: p.tagCount 
		})));
		
		// Update tag counts after posts are loaded
		tagFilterStore.updateTagCounts();
	}

	// Component mount logic
	onMount(() => {
		console.log('🏷️ PostSidenav mounted');
		console.log('🏷️ Initial posts in store:', $postStore.posts.length);
		
		// Only update if posts are already loaded
		if ($postStore.posts.length > 0) {
			console.log('🏷️ Posts already loaded, updating tag counts...');
			tagFilterStore.updateTagCounts();
		} else {
			console.log('🏷️ No posts loaded yet, waiting for posts...');
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

	// Debug reactive statement
	$: {
		console.log('🏷️ Tag counts state:', {
			tagCountsList: tagCountsList.length,
			selectedTagsList: selectedTagsList.length,
			postsCount: $postStore.posts.length,
			loading: $postStore.loading
		});
	}
</script>

{#if $showSidenav}
	<aside class="left-sidebar">
		<div class="sidebar-content">
			<div class="tags-section">
				<div class="tags-header">
					<h3>
						<Icon name="Tag" size={20} />
						<span>Filter by Tags</span>
					</h3>
					
					{#if hasSelectedTags}
						<button 
							class="clear-tags-btn"
							on:click={handleClearTags}
							title="Clear all filters"
						>
							<Icon name="X" size={16} />
							<span>Clear ({selectedTagsList.length})</span>
						</button>
					{/if}
				</div>

				{#if $postStore.loading}
					<div class="loading-tags">
						<Icon name="Loader2" size={20} />
						<p>Loading posts...</p>
					</div>
				{:else if tagCountsList.length > 0}
					<div class="tags-container">
						{#each tagCountsList as { name, count } (name)}
							<button
								class="tag-button"
								class:selected={selectedTagsList.includes(name)}
								on:click={() => handleTagToggle(name)}
								title="Filter posts with '{name}' tag"
							>
								<span class="tag-name">{name}</span>
								<span class="tag-count">{count}</span>
							</button>
						{/each}
					</div>
				{:else if $postStore.posts.length === 0}
					<div class="no-posts">
						<Icon name="MessageSquare" size={24} />
						<p>No posts available</p>
						<small>Create some posts to see tags here</small>
					</div>
				{:else}
					<div class="no-tags">
						<Icon name="Tag" size={24} />
						<p>No tags found in posts</p>
						<small>Add tags to your posts to filter them</small>
					</div>
				{/if}

				{#if hasSelectedTags}
					<div class="filter-info">
						<Icon name="Filter" size={14} />
						<span>Showing posts with: {selectedTagsList.join(', ')}</span>
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
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.left-sidebar {
		width: 100%;
		height: 100%;
		position: relative;
		top: 0;
		overflow-y: auto;
		border-right: 1px solid var(--line-color);
		transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		z-index: 1;
	}

	.left-sidebar.drawer-visible {
		left: 4.5rem;
		padding: 1rem;
	}

	.sidebar-content {
		padding: 1.5rem 1rem;
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
		.left-sidebar {
			height: 80vh;
			width: 100%;
			margin: 2rem;
			border-radius: 0.5rem;
			border-right: none;
			transition: all 0.3s ease;
		}
	}

	.left-sidebar.drawer-visible {
		left: 0;
		padding: 0;
	}

	.filter-status {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 12px;
   padding: 12px 16px;
   margin-bottom: 16px;
   background: var(--primary-light, #eff6ff);
   border: 1px solid var(--primary-color, #3b82f6);
   border-radius: 8px;
   font-size: 14px;
}

.filter-info {
   display: flex;
   align-items: center;
   gap: 8px;
   flex: 1;
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
   background: var(--primary-color, #3b82f6);
   color: white;
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

.clear-all-btn {
   display: flex;
   align-items: center;
   gap: 4px;
   padding: 6px 12px;
   background: white;
   color: var(--primary-color, #3b82f6);
   border: 1px solid var(--primary-color, #3b82f6);
   border-radius: 6px;
   cursor: pointer;
   font-size: 12px;
   font-weight: 500;
   transition: all 0.2s ease;
}

.clear-all-btn:hover {
   background: var(--primary-color, #3b82f6);
   color: white;
}

/* Sidebar Tag Styles */
.tags-section {
   display: flex;
   flex-direction: column;
   gap: 16px;
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
   color: var(--text-primary, #1f2937);
}

.clear-tags-btn {
   display: flex;
   align-items: center;
   gap: 4px;
   padding: 4px 8px;
   background: var(--error-light, #fef2f2);
   color: var(--error-dark, #dc2626);
   border: 1px solid var(--error-light, #fecaca);
   border-radius: 6px;
   font-size: 12px;
   cursor: pointer;
   transition: all 0.2s ease;
}

.clear-tags-btn:hover {
   background: var(--error-color, #dc2626);
   color: white;
}

.tags-container {
   display: flex;
   flex-direction: row;
   flex-wrap: wrap;
   gap: 0.5rem;
   max-height: 60vh;
   overflow-y: auto;
}

.tag-button {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 10px 12px;
   background: var(--surface-secondary, #f9fafb);
   border: 1px solid var(--border-color, #e5e7eb);
   border-radius: 8px;
   cursor: pointer;
   transition: all 0.2s ease;
   text-align: left;
   width: auto;
}

.tag-button:hover {
   background: var(--primary-light, #eff6ff);
   border-color: var(--primary-color, #3b82f6);
   transform: translateY(-1px);
   box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag-button.selected {
   background: var(--primary-color, #3b82f6);
   border-color: var(--primary-color, #3b82f6);
   color: white;
   box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.tag-name {
   font-weight: 500;
   font-size: 14px;
}

.tag-count {
   background: rgba(255, 255, 255, 0.2);
   padding: 2px 6px;
   border-radius: 10px;
   font-size: 12px;
   font-weight: 600;
   min-width: 20px;
   text-align: center;
}

.tag-button:not(.selected) .tag-count {
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
		.left-sidebar {
			width: 100%;
			height: 100%;
			margin: 0;
			position: relative;
			overflow-y: auto;
			border-radius: 0.5rem;
			box-shadow: rgba(29, 28, 28, 0.5) 10px 10px 10px 10px, rgba(29, 28, 28, 0.5) 0px 10px 10px;
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
		
		.clear-all-btn {
			align-self: center;
		}
	}
</style>
