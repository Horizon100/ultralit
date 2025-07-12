<!-- src/routes/chat/+layout.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';

	// This layout ensures chat routes don't get interfered with by root page logic
	onMount(() => {
		if (browser) {
			console.log('Chat layout mounted');
			// Don't redirect - let the chat page handle its own auth logic
		}
	});
</script>

<!-- Just pass through to the chat page -->
<slot />

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}
</style>
