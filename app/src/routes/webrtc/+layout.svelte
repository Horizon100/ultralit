<!-- src/routes/webrtc/+layout.svelte -->
<script lang="ts">
	// import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/features/webrtc/components/Sidebar.svelte';
	import { page } from '$app/stores';
	import { currentUser, ensureAuthenticated } from '$lib/pocketbase'; 
	import { currentLanguage, setLanguage, initializeLanguage, languages, type LanguageCode } from '$lib/stores/languageStore';
	import { t } from '$lib/stores/translationStore';

	$: showSidebar = !$page.url.pathname.startsWith('/webrtc/room/');

	onMount(async () => {
		console.log('WebRTC layout mounted, currentUser:', $currentUser);
	});
</script>

<div class="app-layout">
	{#if showSidebar}
		<div class="main-with-sidebar">
			<Sidebar />
			<main class="content">
				<slot />
			</main>
		</div>
	{:else}
		<main class="content-full">
			<slot />
		</main>
	{/if}
</div>


<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: #0f0f0f;
	}
	
	.main-with-sidebar {
		display: flex;
		flex: 1;
		overflow: hidden;
	}
	
	.content {
		flex: 1;
		overflow: auto;
		background: #1a1a1a;
	}
	
	.content-full {
		flex: 1;
		overflow: hidden;
	}
</style>
