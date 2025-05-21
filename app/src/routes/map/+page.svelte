<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { currentUser } from '$lib/pocketbase';
	import {
		Brain,
		Menu,
		LogIn,
		User,
		LogOut,
		MessageCircle,
		Drill,
		NotebookTabs
	} from 'lucide-svelte';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';
	import GamePlay from '$lib/features/game/components/GamePlay.svelte';

	onMount(() => {
		// Commented out code removed as it wasn't being used
	});
</script>

<div class="app-container">
	<GamePlay />
</div>

<style>
	/* Styles remain mostly unchanged, only minor adjustments */

	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex-grow: 1;
		padding: 2rem 10%;
	}

	@media (max-width: 700px) {
		.nav-links {
			display: none;
		}

		.header-logo {
			display: flex;
		}

		.menu-button {
			position: absolute;
			right: 10px;
		}
	}
</style>
