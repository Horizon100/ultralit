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
				Reset Layout
			</button>
			
			<button 
				class="btn-primary" 
				class:active={isEditMode}
				on:click={toggleEditMode}
			>

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

	:root {
		font-family: var(--font-family);
	}
	.dashboard-container {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-color);
	}
	
	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 2rem;
		border-bottom: 1px solid var(--line-color);
	}
	
	.header-left h1 {
		font-size: 1.875rem;
		font-weight: bold;
		margin: 0;
		color: var(--text-color);
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
		background: var(--bg-color);
		color: var(--text-color);
		font-size: 0.8rem;

	}
	
	.btn-primary:hover {
		background: var(--tertiary-color);
	}
	
	.btn-primary.active {
		background: var(--tertiary-color);
		color: var(--primary-color);
		font-size: 0.8rem;
		font-weight: 800;
	}
	
	.btn-secondary {
		background: transparent;
		color: var(--placeholder-color);
		border: 1px solid var(--line-color);
		font-size: 0.8rem;
	}
	
	.btn-secondary:hover {
		background:red;
		border-color: red;
		color: var(--text-color);
	}
</style>