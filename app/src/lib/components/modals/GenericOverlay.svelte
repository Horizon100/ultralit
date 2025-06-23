<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let title: string = '';

	const dispatch = createEventDispatcher();

	function closeOverlay() {
		dispatch('close');
	}
</script>

<div class="generic-overlay" transition:fade={{ duration: 300 }}>
	<div class="generic-content" transition:fly={{ y: 300, duration: 300 }}>
		<button class="close-button" on:click={closeOverlay}>
			{@html getIcon('X', { size: 30 })}
		</button>
		<h2>{title}</h2>
		<div class="content">
			<slot></slot>
		</div>
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.generic-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.generic-content {
		background-color: #363f3f;
		border-radius: 20px;
		padding: 20px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		position: relative;
	}

	.close-button {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		color: white;
		cursor: pointer;
	}

	h2 {
		color: white;
		margin-bottom: 20px;
	}

	.content {
		color: white;
	}
</style>
