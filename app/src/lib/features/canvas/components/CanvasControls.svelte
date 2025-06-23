<script lang="ts">
	import type { Transform } from '$lib/types/types';
	import Icicle from '$lib/components/charts/Icicle.svelte';

	export let transform: Transform;
	export let onZoom: (direction: 'in' | 'out') => void;
	export let onReset: () => void;

	$: zoomPercentage = Math.round(transform.scale * 100);

	function getZoomDescription(scale: number): string {
		if (scale === 1) return 'Node View';
		if (scale === 2.5) return 'Node Options View';
		return 'Custom View';
	}
</script>

<div class="controls">
	<button on:click={() => onZoom('out')}>-</button>
	<span class="zoom-percentage">{zoomPercentage}% - {getZoomDescription(transform.scale)}</span>
	<button on:click={() => onZoom('in')}>+</button>
	<!-- {#if !isIcicleView}
      <button on:click={onReset}>Reset</button>
    {/if} -->
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.controls {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 10px;
		align-items: center;
		user-select: none;
	}

	button {
		padding: 5px 10px;
		background-color: #2a3130;
		color: lightgray;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	button:hover {
		background-color: #2c3e50;
	}

	.zoom-percentage {
		font-weight: bold;
		min-width: 50px;
		text-align: center;
		color: #2a3130;
	}
</style>
