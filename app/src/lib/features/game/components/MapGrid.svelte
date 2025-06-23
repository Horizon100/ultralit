<!-- src/lib/features/game/components/MapGrid.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { GamePosition, GameTile } from '$lib/types/types.game';

	export let width: number;
	export let height: number;
	export let cellSize: number = 64;
	export let showGrid: boolean = true;
	export let allowMovement: boolean = true;
	export let gridClass: string = '';

	const dispatch = createEventDispatcher();

	// Convert pixel coordinates to grid coordinates
	export function pixelToGrid(pixel: number): number {
		return Math.floor(pixel / cellSize);
	}

	// Convert grid coordinates to pixel coordinates (for centering in grid cell)
	export function gridToPixel(grid: number): number {
		return grid * cellSize + cellSize / 2;
	}

	// Handle grid clicks
	function onGridClick(event: MouseEvent) {
		if (!allowMovement) return;

		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		const pixelX = event.clientX - rect.left;
		const pixelY = event.clientY - rect.top;

		const gridX = Math.floor(pixelX / cellSize);
		const gridY = Math.floor(pixelY / cellSize);

		// Ensure click is within bounds
		if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
			dispatch('gridClick', {
				gridX,
				gridY,
				pixelX: gridToPixel(gridX),
				pixelY: gridToPixel(gridY)
			});
		}
	}

	// Generate road cell class
	export function getRoadCellClass(gridX: number, gridY: number, roads: any[] = []): string {
		if (!roads || roads.length === 0) return '';

		const isOnRoad = roads.some((road) => {
			if (!road || !road.path || road.path.length < 2) return false;

			return road.path.some((point: GamePosition) => {
				const roadGridX = pixelToGrid(point.x);
				const roadGridY = pixelToGrid(point.y);
				return roadGridX === gridX && roadGridY === gridY;
			});
		});

		if (!isOnRoad) return '';

		const roadType = determineRoadType(gridX, gridY, roads);
		return `road-cell ${roadType}`;
	}

	function determineRoadType(gridX: number, gridY: number, roads: any[]): string {
		let hasNorth = false,
			hasSouth = false,
			hasEast = false,
			hasWest = false;

		roads.forEach((road) => {
			if (!road || !road.path) return;

			road.path.forEach((point: GamePosition) => {
				const roadGridX = pixelToGrid(point.x);
				const roadGridY = pixelToGrid(point.y);

				if (roadGridX === gridX && roadGridY === gridY - 1) hasNorth = true;
				if (roadGridX === gridX && roadGridY === gridY + 1) hasSouth = true;
				if (roadGridX === gridX + 1 && roadGridY === gridY) hasEast = true;
				if (roadGridX === gridX - 1 && roadGridY === gridY) hasWest = true;
			});
		});

		const connectionCount = [hasNorth, hasSouth, hasEast, hasWest].filter(Boolean).length;

		if (connectionCount >= 3) return 'road-intersection';
		if ((hasNorth || hasSouth) && (hasEast || hasWest)) return 'road-intersection';
		if (hasNorth || hasSouth) return 'road-vertical';
		if (hasEast || hasWest) return 'road-horizontal';

		return 'road-horizontal';
	}
</script>

<div
	class="map-grid {gridClass}"
	class:show-grid={showGrid}
	class:clickable={allowMovement}
	style="--grid-width: {width}; --grid-height: {height}; --cell-size: {cellSize}px;"
	on:click={onGridClick}
>
	<!-- Grid cells -->
	{#each Array(height) as _, rowIndex}
		{#each Array(width) as _, colIndex}
			<div
				class="grid-cell"
				data-x={colIndex}
				data-y={rowIndex}
				style="grid-column: {colIndex + 1}; grid-row: {rowIndex + 1};"
			></div>
		{/each}
	{/each}

	<!-- Slot for positioned content -->
	<slot></slot>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.map-grid {
		display: grid;
		grid-template-columns: repeat(var(--grid-width), var(--cell-size));
		grid-template-rows: repeat(var(--grid-height), var(--cell-size));
		position: relative;
		width: calc(var(--grid-width) * var(--cell-size));
		height: calc(var(--grid-height) * var(--cell-size));
		background: linear-gradient(135deg, #87ceeb, #e0f6ff);
	}

	.map-grid.show-grid {
		background-image:
			linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
		background-size: var(--cell-size) var(--cell-size);
	}

	.map-grid.clickable {
		cursor: pointer;
	}

	.grid-cell {
		/* Remove margin that was causing positioning issues */
		border: none;
		/* Uncomment for hexagon cells */
		/* clip-path: polygon(
			30% 0%, 
			70% 0%, 
			100% 30%, 
			100% 70%, 
			70% 100%, 
			30% 100%, 
			0% 70%, 
			0% 30%
		); */
	}

	.grid-cell:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	/* Road styling */
	:global(.grid-cell.road-cell) {
		background-color: #8b7355 !important;
		border-color: #6b5b47;
	}

	:global(.grid-cell.road-cell.road-horizontal) {
		background: linear-gradient(
			to bottom,
			#6b5b47 0%,
			#8b7355 20%,
			#a0956b 50%,
			#8b7355 80%,
			#6b5b47 100%
		) !important;
	}

	:global(.grid-cell.road-cell.road-vertical) {
		background: linear-gradient(
			to right,
			#6b5b47 0%,
			#8b7355 20%,
			#a0956b 50%,
			#8b7355 80%,
			#6b5b47 100%
		) !important;
	}

	:global(.grid-cell.road-cell.road-intersection) {
		background: radial-gradient(circle at center, #a0956b 0%, #8b7355 50%, #6b5b47 100%) !important;
	}

	:global(.grid-cell.road-cell:hover) {
		filter: brightness(1.2);
	}

	/* Positioned content within grid */
	.map-grid > :global(:not(.grid-cell)) {
		position: absolute;
		z-index: 10;
	}
</style>
