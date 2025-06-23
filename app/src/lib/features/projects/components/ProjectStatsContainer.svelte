<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	import { projectStore } from '$lib/stores/projectStore';
	import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';

	// Stats variables
	let messageCount = 0;
	let collaboratorCount = 0;
	let documentCount = 0;
	let completionPercentage = 0;
	let lastActive: Date | null = null;
	let isLoading: boolean = false;

	function formatDate(date: string | Date): string {
		if (date === 'Today' || date === 'Yesterday') return date;
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		return dateObj.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function calculatePercentage(count: number, target: number): number {
		return Math.min(Math.round((count / target) * 100), 100);
	}

	export async function fetchProjectStats(id: string) {
		if (!id) {
			console.error('No project ID provided');
			return;
		}

		isLoading = true;
		console.log('Fetching stats for project:', id);

		// Reset stats first
		messageCount = 0;
		collaboratorCount = 0;
		documentCount = 0;
		completionPercentage = 0;
		lastActive = null;

		const result = await fetchTryCatch<{ success: boolean; data?: any; error?: string }>(
			`/api/projects/${id}/stats`,
			{
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			}
		);

		if (isSuccess(result)) {
			const { success, data } = result.data;

			if (success && data) {
				messageCount = data.messageCount || 0;
				documentCount = data.documentCount || 0;
				collaboratorCount = data.collaboratorCount || 0;
				completionPercentage = data.completionPercentage || 0;
				lastActive = data.lastActive ? new Date(data.lastActive) : null;

				console.log('Stats fetched successfully:', {
					messageCount,
					documentCount,
					collaboratorCount,
					completionPercentage,
					lastActive
				});
			} else {
				console.warn('Stats response was unsuccessful or missing data');
			}
		} else {
			console.error('Error fetching project stats:', result.error);
			// Reset stats on error
			messageCount = 0;
			collaboratorCount = 0;
			documentCount = 0;
			completionPercentage = 0;
			lastActive = null;
		}

		isLoading = false;
	}

	// Track when store values change
	$: projectId = $projectStore.currentProjectId;
	$: project = $projectStore.currentProject;

	// When projectId changes, fetch new stats
	$: if (projectId) {
		console.log('ProjectStatsContainer: projectId changed to', projectId);
		fetchProjectStats(projectId);
	}
	$: messageLabel = ($t('dashboard.nameMessages') ?? 'Messages') as string;
	$: collaboratorLabel = ($t('dashboard.nameCollaborators') ?? 'Collaborators') as string;
	$: documentLabel = ($t('dashboard.nameDocuments') ?? 'Documents') as string;
	$: completionLabel = ($t('dashboard.nameCompletion') ?? 'Completion') as string;
	$: activeLabel = ($t('dashboard.nameActive') ?? 'Last Active') as string;
	$: noProjectLabel = ($t('dashboard.noProjectSelected') ?? 'No project selected') as string;
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
		<div class="stat-item" style="--progress: {calculatePercentage(messageCount, 100)}%">
			<span>{messageCount} {messageLabel}</span>
			<span class="target">100 ✰</span>
		</div>

		<div class="stat-item" style="--progress: {calculatePercentage(collaboratorCount, 10)}%">
			<span>{collaboratorCount} {collaboratorLabel}</span>
			<span class="target">10 ✰</span>
		</div>

		<div class="stat-item" style="--progress: {calculatePercentage(documentCount, 50)}%">
			<span>{documentCount} {documentLabel}</span>
			<span class="target">50 ✰</span>
		</div>

		<div class="stat-item" style="--progress: {completionPercentage}%">
			<span>{completionPercentage}% {completionLabel}</span>
			<span class="target">100% ✰</span>
		</div>

		<div class="last-active">
			{activeLabel}: {lastActive ? formatDate(lastActive) : 'Never'}
			{lastActive ? formatDate(lastActive) : 'Never'}
		</div>
	</div>
{:else}
	<div class="stats-container empty-state">
		<p>{noProjectLabel}</p>
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

	.empty-state {
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
