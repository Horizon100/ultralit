<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
	import DashboardGrid from '$lib/features/webrtc/components/DashboardGrid.svelte';
	import ProjectCard from '$lib/features/webrtc/components/ProjectCard.svelte';
	import VideoGrid from '$lib/features/webrtc/components/VideoGrid.svelte';
	import Chat from '$lib/features/webrtc/components/Chat.svelte';
	import Moderator from '$lib/features/webrtc/components/Moderator.svelte';
	import Automator from '$lib/features/webrtc/components/Automator.svelte';
	import { dashboardLayoutStore } from '$lib/features/webrtc/stores/dashboard-store';
	
	let isEditMode = false;
	
	const availableComponents = [
		{ id: 'video', component: VideoGrid, title: 'Video Stream', defaultSize: { w: 6, h: 4 } },
		{ id: 'chat', component: Chat, title: 'Chat', defaultSize: { w: 3, h: 6 } },
		{ id: 'moderator', component: Moderator, title: 'Mod Actions', defaultSize: { w: 3, h: 4 } },
		{ id: 'automator', component: Automator, title: 'AutoMod Queue', defaultSize: { w: 3, h: 3 } },
		{ id: 'projects', component: ProjectCard, title: 'Active Projects', defaultSize: { w: 6, h: 3 } }
	];
	
	function toggleEditMode() {
		isEditMode = !isEditMode;
	}
	
	function resetLayout() {
		dashboardLayoutStore.resetToDefault();
		isEditMode = false;
	}
</script>

<svelte:head>
	<title>Dashboard - Mod View</title>
</svelte:head>

<div class="dashboard-container">
	<div class="dashboard-header">
		<div class="header-left">
			<h1>Dashboard</h1>
			<span class="subtitle">Manage your streams and moderation</span>
		</div>
		
		<div class="header-controls">
			<button class="btn-secondary" on:click={resetLayout}>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				Reset Layout
			</button>
			
			<button 
				class="btn-primary" 
				class:active={isEditMode}
				on:click={toggleEditMode}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
				{isEditMode ? 'Done Editing' : 'Edit Layout'}
			</button>
		</div>
	</div>
	
	<DashboardGrid {isEditMode} {availableComponents} />
</div>

<style lang="scss">
		* {
		font-family: var(--font-family);
	}
	.dashboard-container {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: #0f0f0f;
	}
	
	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #333;
		background: #111;
	}
	
	.header-left h1 {
		font-size: 1.875rem;
		font-weight: bold;
		margin: 0;
		color: white;
	}
	
	.subtitle {
		color: #94a3b8;
		font-size: 0.875rem;
	}
	
	.header-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	
	.btn-primary, .btn-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}
	
	.btn-primary {
		background: #667eea;
		color: white;
	}
	
	.btn-primary:hover {
		background: #5a67d8;
	}
	
	.btn-primary.active {
		background: #10b981;
	}
	
	.btn-secondary {
		background: transparent;
		color: #94a3b8;
		border: 1px solid #374151;
	}
	
	.btn-secondary:hover {
		background: rgba(102, 126, 234, 0.1);
		border-color: #667eea;
		color: white;
	}
</style>