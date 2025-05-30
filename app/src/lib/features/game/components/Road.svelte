<!-- src/routes/game/navigator/Road.svelte -->
<script lang="ts">
	import type { GameRoad } from '$lib/types/types.game';

	export let road: GameRoad;
	export let GRID_SIZE: number;

	// Convert road path points to grid-aligned coordinates
	function getGridAlignedPath(path: { x: number; y: number }[]) {
		return path.map((point) => ({
			x: Math.floor(point.x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2,
			y: Math.floor(point.y / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2
		}));
	}

	$: alignedPath = getGridAlignedPath(road.path);
	$: pathString = alignedPath
		.map((point, index) => (index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`))
		.join(' ');

	// Calculate road bounds for SVG viewBox
	$: bounds = alignedPath.reduce(
		(acc, point) => ({
			minX: Math.min(acc.minX, point.x),
			minY: Math.min(acc.minY, point.y),
			maxX: Math.max(acc.maxX, point.x),
			maxY: Math.max(acc.maxY, point.y)
		}),
		{ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
	);

	$: viewBox = `${bounds.minX - 10} ${bounds.minY - 10} ${bounds.maxX - bounds.minX + 20} ${bounds.maxY - bounds.minY + 20}`;
</script>

<svg
	class="road-svg"
	width="100%"
	height="100%"
	{viewBox}
	style="position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;"
>
	<!-- Road base -->
	<path
		d={pathString}
		stroke="#8B7355"
		stroke-width="12"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="road-base"
	/>

	<!-- Road center line -->
	<path
		d={pathString}
		stroke="#6D5D43"
		stroke-width="2"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-dasharray="8 4"
		class="road-centerline"
	/>

	<!-- Animated traffic flow (optional) -->
	{#if road.hasTraffic}
		<path
			d={pathString}
			stroke="#FFD700"
			stroke-width="4"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-dasharray="6 6"
			class="road-traffic"
		/>
	{/if}
</svg>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.road-svg {
		overflow: visible;
	}

	.road-base {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
	}

	.road-centerline {
		opacity: 0.7;
	}

	.road-traffic {
		animation: traffic-flow 3s linear infinite;
		opacity: 0.8;
	}

	@keyframes traffic-flow {
		from {
			stroke-dashoffset: 0;
		}
		to {
			stroke-dashoffset: 12;
		}
	}
</style>
