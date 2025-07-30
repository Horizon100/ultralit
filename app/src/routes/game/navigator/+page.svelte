<!-- src/routes/game/navigator/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { gameStore } from '$lib/stores/gameStore';
	import { projectStore } from '$lib/stores/projectStore';
	import { currentUser } from '$lib/pocketbase';
	import { gameClient } from '$lib/clients/gameClient';

	import MapView from '$lib/features/game/components/MapView.svelte';
	import Road from '$lib/features/game/components/Road.svelte';
	import Hero from '$lib/features/game/components/Hero.svelte';
	import {
		gameService,
		gameBuildingStore,
		gameRoomStore,
		gameRoadStore,
		otherHeroesStore
	} from '$lib/stores/gameStore';
	import type {
		GameBuilding,
		GameRoad as GameRoadType,
		GameHero,
		GamePageData
	} from '$lib/types/types.game';

	export let data: GamePageData;

	// Grid configuration
	const GRID_SIZE = 64; // Size of each grid cell in pixels
	const MAP_WIDTH = 50; // Number of grid columns
	const MAP_HEIGHT = 50; // Number of grid rows

	// Track if we're inside a building
	let isInsideBuilding = false;

	let heroDirection: 'left' | 'right' | 'up' | 'down' = 'down';

	// Camera/viewport management
	let mapContainer: HTMLDivElement;
	let camera = {
		x: 0,
		y: 0,
		targetX: 0,
		targetY: 0,
		smoothing: 0.1
	};

	// Map data from stores
	$: buildings = $gameBuildingStore || [];
	$: roads = $gameRoadStore || [];
	$: otherHeroes = $otherHeroesStore;

	// Convert pixel coordinates to grid coordinates
	function pixelToGrid(pixel: number): number {
		return Math.floor(pixel / GRID_SIZE);
	}

	// Convert grid coordinates to pixel coordinates (for centering in grid cell)
	function gridToPixel(grid: number): number {
		return grid * GRID_SIZE + GRID_SIZE / 2;
	}

	// Follow the hero with the camera
	function followHero() {
		const $gameStore = get(gameStore);
		if (!$gameStore.heroPawn || !mapContainer) return;

		const heroPos = $gameStore.heroPawn.position;
		const containerRect = mapContainer.getBoundingClientRect();

		// Calculate where the hero should be positioned (center of viewport)
		const viewportCenterX = containerRect.width / 2;
		const viewportCenterY = containerRect.height / 2;

		// Calculate the camera target position
		camera.targetX = viewportCenterX - heroPos.x;
		camera.targetY = viewportCenterY - heroPos.y;

		// Constrain camera to map bounds
		const mapPixelWidth = MAP_WIDTH * GRID_SIZE;
		const mapPixelHeight = MAP_HEIGHT * GRID_SIZE;

		camera.targetX = Math.min(0, Math.max(containerRect.width - mapPixelWidth, camera.targetX));
		camera.targetY = Math.min(0, Math.max(containerRect.height - mapPixelHeight, camera.targetY));
	}

	// Update camera position smoothly
	function updateCamera() {
		camera.x += (camera.targetX - camera.x) * camera.smoothing;
		camera.y += (camera.targetY - camera.y) * camera.smoothing;

		if (mapContainer) {
			const mapGrid = mapContainer.querySelector('.map-grid') as HTMLElement;
			if (mapGrid) {
				mapGrid.style.transform = `translate(${camera.x}px, ${camera.y}px)`;
			}
		}

		requestAnimationFrame(updateCamera);
	}

	// Follow hero when their position changes
	$: if ($gameStore.heroPawn) {
		followHero();
	}

	// Road cell styling functions
	function getRoadCellClass(gridX: number, gridY: number): string {
		if (!roads || roads.length === 0) return '';

		// Check if this grid position is part of any road
		const isOnRoad = roads.some((road) => {
			if (!road || !road.path || road.path.length < 2) return false;

			return road.path.some((point) => {
				const roadGridX = pixelToGrid(point.x);
				const roadGridY = pixelToGrid(point.y);
				return roadGridX === gridX && roadGridY === gridY;
			});
		});

		if (!isOnRoad) return '';

		// Determine road direction for styling
		const roadType = determineRoadType(gridX, gridY);
		return `road-cell ${roadType}`;
	}

	function determineRoadType(gridX: number, gridY: number): string {
		let hasNorth = false,
			hasSouth = false,
			hasEast = false,
			hasWest = false;

		// Check adjacent cells for road connections
		roads.forEach((road) => {
			if (!road || !road.path) return;

			road.path.forEach((point) => {
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

		return 'road-horizontal'; // default
	}

	// Handle keyboard movement
	function setupKeyboardControls() {
		window.addEventListener('keydown', (e) => {
			const $gameStore = get(gameStore);
			if (!$gameStore.heroPawn || !data.user) return;

			// Don't handle movement if we're inside a building
			if (isInsideBuilding) return;

			let direction = '';
			switch (e.key) {
				case 'ArrowUp':
				case 'w':
				case 'W':
					direction = 'up';
					break;
				case 'ArrowDown':
				case 's':
				case 'S':
					direction = 'down';
					break;
				case 'ArrowLeft':
				case 'a':
				case 'A':
					direction = 'left';
					break;
				case 'ArrowRight':
				case 'd':
				case 'D':
					direction = 'right';
					break;
				default:
					return;
			}

			e.preventDefault();
			handleGridMovement(direction);
		});
	}

	// Grid-based movement
	async function handleGridMovement(direction: string) {
		const $gameStore = get(gameStore);
		if (!$gameStore.heroPawn || !data.user) return;
		heroDirection = direction as 'left' | 'right' | 'up' | 'down';
		const currentPos = $gameStore.heroPawn.position;
		const gridX = pixelToGrid(currentPos.x);
		const gridY = pixelToGrid(currentPos.y);

		let newGridX = gridX;
		let newGridY = gridY;

		switch (direction) {
			case 'up':
				newGridY = Math.max(0, gridY - 1);
				break;
			case 'down':
				newGridY = Math.min(MAP_HEIGHT - 1, gridY + 1);
				break;
			case 'left':
				newGridX = Math.max(0, gridX - 1);
				break;
			case 'right':
				newGridX = Math.min(MAP_WIDTH - 1, gridX + 1);
				break;
		}

		// Check for collisions with buildings
		if (!isPositionBlocked(newGridX, newGridY)) {
			const newPixelPos = {
				x: gridToPixel(newGridX),
				y: gridToPixel(newGridY)
			};

			await gameClient.moveHeroImmediate(data.user.id, newPixelPos);
		}
	}

	// Check if a grid position is blocked by a building
	function isPositionBlocked(gridX: number, gridY: number): boolean {
		return buildings.some((container: GameBuilding) => {
			const containerGridX = pixelToGrid(container.position.x);
			const containerGridY = pixelToGrid(container.position.y);
			return containerGridX === gridX && containerGridY === gridY;
		});
	}

	// Handle map clicks for movement
	async function onMapClick(event: MouseEvent) {
		// Don't handle clicks if we're inside a building
		if (isInsideBuilding) return;

		const mapGrid = event.currentTarget as HTMLElement;
		const rect = mapGrid.getBoundingClientRect();

		// Account for camera offset
		const pixelX = event.clientX - rect.left - camera.x;
		const pixelY = event.clientY - rect.top - camera.y;

		const gridX = Math.floor(pixelX / GRID_SIZE);
		const gridY = Math.floor(pixelY / GRID_SIZE);

		// Ensure click is within map bounds
		if (gridX >= 0 && gridX < MAP_WIDTH && gridY >= 0 && gridY < MAP_HEIGHT) {
			if (!isPositionBlocked(gridX, gridY)) {
				const newPixelPos = {
					x: gridToPixel(gridX),
					y: gridToPixel(gridY)
				};

				if (data.user) {
					await gameClient.moveHeroImmediate(data.user.id, newPixelPos);
				}
			}
		}
	}

	onMount(async () => {
		if (browser) {
			setupKeyboardControls();

			// Start camera update loop
			updateCamera();

			// Initialize game with project context
			const user = get(currentUser);

			if (user) {
				// Initialize visibility handling for better sync management
				gameClient.initializeVisibilityHandling(user.id);
			}
		}
	});
</script>

<div class="map-navigator">
	<div class="minimap">
		<div class="minimap-content">
			{#each buildings as container}
				<div
					class="minimap-building"
					style="left: {pixelToGrid(container.position.x) * 2.4}px; top: {pixelToGrid(
						container.position.y
					) * 1.6}px;"
				>
					<div class="minimap-building-dot"></div>
				</div>
			{/each}

			{#if $gameStore.heroPawn}
				<div
					class="minimap-player"
					style="left: {pixelToGrid($gameStore.heroPawn.position.x) * 2.4}px; top: {pixelToGrid(
						$gameStore.heroPawn.position.y
					) * 1.6}px;"
				>
					<div class="minimap-player-dot"></div>
				</div>
			{/if}
		</div>
	</div>

	<div bind:this={mapContainer} class="map-container" role="application">
		<div
			class="map-grid"
			on:click={onMapClick}
			style="--map-width: {MAP_WIDTH}; --map-height: {MAP_HEIGHT}; --grid-size: {GRID_SIZE}px;"
		>
			{#each Array(MAP_HEIGHT).fill(0) as _, rowIndex}
				{#each Array(MAP_WIDTH).fill(0) as _, colIndex}
					<div
						class="grid-cell {getRoadCellClass(colIndex, rowIndex)}"
						data-x={colIndex}
						data-y={rowIndex}
					></div>
				{/each}
			{/each}

			{#each roads as road}
				{#if road && road.path && road.path.length >= 2}
					<Road {road} {GRID_SIZE} />
				{/if}
			{/each}

			{#each buildings as container}
				<MapView {container} gridSize={GRID_SIZE} {data} bind:isInsideBuilding />
			{/each}

			{#each otherHeroes as hero}
				<Hero {hero} isCurrentUser={false} gridSize={GRID_SIZE} />
			{/each}

			{#if $gameStore.heroPawn}
				<Hero
					hero={$gameStore.heroPawn}
					isCurrentUser={true}
					gridSize={GRID_SIZE}
					direction={heroDirection}
				/>
			{/if}
		</div>
	</div>
</div>
a

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	.map-navigator {
		height: 100%;
		width: 100%;
		position: relative;
		overflow: hidden;
		background: linear-gradient(135deg, #87ceeb, #e0f6ff);
	}

	.map-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.minimap {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 12rem;
		height: 8rem;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 0.5rem;
		border: 2px solid #d1d5db;
		z-index: 20;
		backdrop-filter: blur(5px);
	}

	.minimap-content {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.minimap-building {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	.minimap-building-dot {
		width: 0.75rem;
		height: 0.75rem;
		background-color: #3b82f6;
		border-radius: 0.25rem;
	}

	.minimap-player {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	.minimap-player-dot {
		width: 0.5rem;
		height: 0.5rem;
		background-color: #ef4444;
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.map-grid {
		display: grid;
		grid-template-columns: repeat(var(--map-width), var(--grid-size));
		grid-template-rows: repeat(var(--map-height), var(--grid-size));
		position: relative;
		width: calc(var(--map-width) * var(--grid-size));
		height: calc(var(--map-height) * var(--grid-size));
		margin: 0 auto;
		background-image:
			linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
		background-size: var(--grid-size) var(--grid-size);
	}

	.grid-cell {
		position: relative;
		border: 1px solid rgba(0, 0, 0, 0.02);
		transition: background-color 0.2s ease;

		// Road cell styling
		&.road-cell {
			background-color: #8b7355; // Brown/dirt road color
			border-color: #6b5b47;

			&.road-horizontal {
				background: linear-gradient(
					to bottom,
					#6b5b47 0%,
					#8b7355 20%,
					#a0956b 50%,
					#8b7355 80%,
					#6b5b47 100%
				);
			}

			&.road-vertical {
				background: linear-gradient(
					to right,
					#6b5b47 0%,
					#8b7355 20%,
					#a0956b 50%,
					#8b7355 80%,
					#6b5b47 100%
				);
			}

			&.road-intersection {
				background: radial-gradient(circle at center, #a0956b 0%, #8b7355 50%, #6b5b47 100%);
			}
		}
	}

	.grid-cell:hover:not(.road-cell) {
		background-color: rgba(34, 197, 94, 0.1);
		cursor: pointer;
	}

	// Road-specific hover effect
	.grid-cell.road-cell:hover {
		filter: brightness(1.2);
		cursor: pointer;
	}

	// All positioned elements within the grid
	.map-grid > :not(.grid-cell) {
		position: absolute;
		z-index: 10;
	}
</style>
