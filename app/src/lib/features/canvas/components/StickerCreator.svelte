<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let x: number;
	export let y: number;
	// export let on: { create: () => void };
	let text: string = '';

	function handleCreate() {
		if (text.trim()) {
			dispatch('create', { x, y, text });
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="sticker-creator" style="left: {x}px; top: {y}px;">
	<textarea bind:value={text} placeholder="Enter sticker text..."></textarea>
	<div class="actions">
		<button on:click={handleCreate}>Create Sticker</button>
		<button on:click={handleCancel}>Cancel</button>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.sticker-creator {
		position: absolute;
		background-color: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		padding: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
	}

	textarea {
		width: 200px;
		height: 100px;
		margin-bottom: 10px;
		padding: 5px;
		font-size: 14px;
		border-radius: 4px;
		border: 1px solid #ddd;
		resize: none;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	button {
		padding: 5px 10px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #f0f0f0;
	}

	button:active {
		background-color: #e0e0e0;
	}
</style>
