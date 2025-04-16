<script lang="ts">
	import { onMount } from 'svelte';
	// import {  } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { projectStore } from '$lib/stores/projectStore';

	// Stats variables
	let messageCount = 0;
	let collaboratorCount = 0;
	let documentCount = 0;
	let completionPercentage = 0;
	let lastActive: Date | null = null;
	let isLoading: boolean = false;



	function formatDate(date: string): string {
		if (date === 'Today' || date === 'Yesterday') return date;
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function calculatePercentage(count: number, target: number): number {
		return Math.min(Math.round((count / target) * 100), 100);
	}

	async function fetchCount(collection: string, filter: string): Promise<number> {
		if (!pb.authStore.isValid) {
			console.error('User is not authenticated');
			return 0;
		}

		try {
			const resultList = await pb.collection(collection).getList(1, 1, {
				sort: '-created',
				filter: filter,
				$autoCancel: false
			});
			return resultList.totalItems;
		} catch (error) {
			console.error(`Error fetching ${collection} count:`, error);
			return 0;
		}
	}

	export async function fetchProjectStats(id: string) {
		if (!pb.authStore.isValid || !id) {
			console.error('User is not authenticated or no project selected');
			return;
		}

		try {
			isLoading = true;
			console.log('Fetching stats for project:', id);
			
			// Reset stats first
			messageCount = 0;
			collaboratorCount = 0;
			documentCount = 0;
			completionPercentage = 0;
			lastActive = null;
			
			// Fetch each stat individually
			messageCount = await fetchCount('messages', `project = "${id}"`);
			documentCount = await fetchCount('documents', `project = "${id}"`);
			
			// Get collaborator count
			collaboratorCount = $projectStore.collaborators?.length || 0;
			
			// Get last active time
			try {
				const lastMessageResult = await pb.collection('messages').getList(1, 1, {
					filter: `project = "${id}"`,
					sort: '-created',
					$autoCancel: false
				});
				if (lastMessageResult.items.length > 0) {
					lastActive = new Date(lastMessageResult.items[0].created);
				}
			} catch (error) {
				console.error('Error fetching last active time:', error);
			}
			
			// Calculate completion percentage
			const projectTasks = await fetchCount('tasks', `project = "${id}"`);
			const completedTasks = await fetchCount('tasks', `project = "${id}" && status = "completed"`);
			completionPercentage = projectTasks > 0 ? calculatePercentage(completedTasks, projectTasks) : 0;
			
			console.log('Stats fetched successfully:', {
				messageCount,
				documentCount,
				collaboratorCount,
				completionPercentage,
				lastActive
			});
		} catch (error) {
			console.error('Error fetching project stats:', error);
		} finally {
			isLoading = false;
		}
	}
	// Track when store values change
	$: projectId = $projectStore.currentProjectId;
	$: project = $projectStore.currentProject;
	
	// When projectId changes, fetch new stats
	$: if (projectId) {
		console.log('ProjectStatsContainer: projectId changed to', projectId);
		fetchProjectStats(projectId);
	}
	onMount(() => {
		if (projectId) {
			console.log('Component mounted, projectId:', projectId);
			fetchProjectStats(projectId);
		}
	});
</script>

{#if isLoading}
<div class="spinner-container">
	<div class="spinner"></div>
</div>
{:else if project}
<div class="stats-container">
	<!-- <div class="title">
		<h2>{project?.name || $t('dashboard.projectStats')}</h2>
	</div> -->
	<div class="stat-item" style="--progress: {calculatePercentage(messageCount, 100)}%">
		<span>{messageCount} {$t('dashboard.nameMessages')}</span>
		<span class="target">100 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {calculatePercentage(collaboratorCount, 10)}%">
		<span>{collaboratorCount} {$t('dashboard.nameCollaborators')}</span>
		<span class="target">10 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {calculatePercentage(documentCount, 50)}%">
		<span>{documentCount} {$t('dashboard.nameDocuments')}</span>
		<span class="target">50 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {completionPercentage}%">
		<span>{completionPercentage}% {$t('dashboard.nameCompletion')}</span>
		<span class="target">100% ✰</span>
	</div>

	<div class="last-active">
		{$t('dashboard.nameActive')}
		{lastActive ? formatDate(lastActive.toString()) : 'Never'}
	</div>
</div>
{:else}
<div class="stats-container empty-state">
	<p>{$t('dashboard.noProjectSelected')}</p>
</div>
{/if}

<style lang="scss">
	* {
      font-family: var(--font-family);
    }
	
	.stats-container {
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
		margin-right: 6rem;
		height: auto;
		margin-top: 0;
		margin-left: 0;
		position: relative;
		overflow: hidden;
	}
	
	.empty-state, .loading {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 200px;
		color: #cccccc;
		font-style: italic;
	}

	.stats-container::before {
		content: '';
		position: absolute;
		top: -150%;
		left: -150%;
		width: 300%;
		height: 300%;
		background: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2)
		);
		transform: translateX(-100%) rotate(45deg);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	.title {
		display: flex;
	}
	
	.stats-container:hover::before {
		animation: swipe 0.5s cubic-bezier(0.42, 0, 0.58, 1);
		opacity: 1;
	}

	@keyframes swipe {
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}

	.stats-container h2 {
		display: flex;
		justify-content: right;
		color: white;
	}

	.stat-item {
		display: flex;
		align-items: center;
		position: relative;
		padding: 1rem;
		justify-content: space-between;
		color: #cccccc;
		font-size: 1rem;
		overflow: hidden;
		transition: all 0.5s ease;
		border-radius: 0.5rem;
		background: linear-gradient(
			to right,
			rgba(0, 128, 0, 0.2) var(--progress),
			rgba(128, 128, 128, 0.1) var(--progress)
		);
	}

	.stat-item:hover {
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 20%,
			rgba(247, 247, 247, 0.2) 96%
		);
	}

	.stat-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			rgba(1, 149, 137, 0.5) var(--progress),
			transparent var(--progress)
		);
		z-index: -1;
	}

	.last-active {
		color: #cccccc;
		text-align: right;
		font-size: 0.9em;
	}
</style>