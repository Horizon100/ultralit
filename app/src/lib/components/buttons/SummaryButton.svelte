<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatMessage } from '$lib/types/types';

	export let messages: ChatMessage[];

	const dispatch = createEventDispatcher();

	async function generateSummary() {
		// Implement your summary generation logic here
		const summary = 'This is a placeholder summary.';
		dispatch('summary', summary);
	}
</script>

<button on:click={generateSummary}> Generate Summary </button>
