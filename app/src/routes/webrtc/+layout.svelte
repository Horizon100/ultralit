<!-- src/routes/webrtc/+layout.svelte -->
<script lang="ts">
	// import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/features/webrtc/components/Sidebar.svelte';
	import { page } from '$app/stores';
	import { currentUser, ensureAuthenticated } from '$lib/pocketbase'; 
	import { currentLanguage, setLanguage, initializeLanguage, languages, type LanguageCode } from '$lib/stores/languageStore';
	import { t } from '$lib/stores/translationStore';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import { fly } from 'svelte/transition';

	onMount(async () => {
		console.log('WebRTC layout mounted, currentUser:', $currentUser);
	});
</script>

<div class="app-layout">
		<div 
			class="main-with-sidebar"
	transition:fly={{ x: -200, duration: 300 }}
		>
			<Sidebar />
			<main class="content">
				<slot />
			</main>
		</div>

</div>


<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}		

	.app-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		
	}
	
	.main-with-sidebar {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;

	}
	
	.content {
		flex: 1;
		overflow: auto;
	}
	
	.content-full {
		flex: 1;
		overflow: hidden;
	}
</style>
