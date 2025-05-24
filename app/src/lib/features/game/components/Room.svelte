<!-- src/routes/game/navigator/Room.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { gameRoomStore, gameStore } from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import { gameClient } from '$lib/clients/gameClient';
	import type { GameMap, GameRoom } from '$lib/types/types.game';

	export let currentMap: GameMap | null = null;
	export let isExpanded: boolean = false;
	export let data: any;
	export let GRID_SIZE: number;
	export let pixelToGrid: (pixel: number) => number;
	export let gridX: number;
	export let gridY: number;

	const dispatch = createEventDispatcher();

	// Building interior layout - 8x8 grid for detailed exploration
	const BUILDING_GRID_SIZE = 8;
	const CELL_SIZE = 32; // Smaller cells for more detailed movement

	// Hero position within the building (pixel-based for smooth movement)
	let heroPosition = { x: 4 * CELL_SIZE, y: 7 * CELL_SIZE }; // Start at entrance
	let targetPosition = { ...heroPosition };

	// Room layout and corridors
	$: rooms = currentMap ? $gameRoomStore.filter((room) => room.mapContainer === currentMap.id) : [];
	$: buildingLayout = createBuildingLayout(rooms);

	function createBuildingLayout(rooms: GameRoom[]): BuildingCell[][] {
		const layout: BuildingCell[][] = Array(BUILDING_GRID_SIZE)
			.fill(null)
			.map(() =>
				Array(BUILDING_GRID_SIZE)
					.fill(null)
					.map(() => ({ type: 'empty', room: null }))
			);

		// Create corridors (main hallway)
		for (let x = 1; x < BUILDING_GRID_SIZE - 1; x++) {
			layout[3][x] = { type: 'corridor', room: null };
			layout[4][x] = { type: 'corridor', room: null };
		}

		// Vertical corridors
		for (let y = 1; y < BUILDING_GRID_SIZE - 1; y++) {
			layout[y][1] = { type: 'corridor', room: null };
			layout[y][6] = { type: 'corridor', room: null };
		}

		// Lobby area
		layout[5][3] = { type: 'lobby', room: null };
		layout[5][4] = { type: 'lobby', room: null };
		layout[6][3] = { type: 'lobby', room: null };
		layout[6][4] = { type: 'lobby', room: null };

		// Entrance
		layout[7][3] = { type: 'entrance', room: null };
		layout[7][4] = { type: 'entrance', room: null };

		// Place rooms strategically
		const roomPositions = [
			{ x: 0, y: 0, w: 2, h: 2 }, // Top-left large room
			{ x: 2, y: 0, w: 3, h: 2 }, // Top-center large room
			{ x: 5, y: 0, w: 3, h: 2 }, // Top-right large room
			{ x: 0, y: 5, w: 2, h: 2 }, // Bottom-left room
			{ x: 5, y: 5, w: 3, h: 2 }, // Bottom-right room
			{ x: 2, y: 6, w: 1, h: 1 }, // Small room
			{ x: 7, y: 0, w: 1, h: 3 } // Tall narrow room
		];

		rooms.forEach((room, index) => {
			if (index < roomPositions.length) {
				const pos = roomPositions[index];
				for (let y = pos.y; y < pos.y + pos.h && y < BUILDING_GRID_SIZE; y++) {
					for (let x = pos.x; x < pos.x + pos.w && x < BUILDING_GRID_SIZE; x++) {
						layout[y][x] = { type: 'room', room, roomIndex: index };
					}
				}
			}
		});

		return layout;
	}

	interface BuildingCell {
		type: 'empty' | 'wall' | 'room' | 'corridor' | 'lobby' | 'entrance';
		room?: GameRoom | null;
		roomIndex?: number;
	}

	// Movement with smaller increments
	function handleBuildingMovement(event: KeyboardEvent) {
		if (!isExpanded) return;

		const moveAmount = CELL_SIZE / 2; // Even smaller movements
		let newX = targetPosition.x;
		let newY = targetPosition.y;

		switch (event.key) {
			case 'ArrowUp':
			case 'w':
			case 'W':
				newY = Math.max(0, targetPosition.y - moveAmount);
				break;
			case 'ArrowDown':
			case 's':
			case 'S':
				newY = Math.min((BUILDING_GRID_SIZE - 1) * CELL_SIZE, targetPosition.y + moveAmount);
				break;
			case 'ArrowLeft':
			case 'a':
			case 'A':
				newX = Math.max(0, targetPosition.x - moveAmount);
				break;
			case 'ArrowRight':
			case 'd':
			case 'D':
				newX = Math.min((BUILDING_GRID_SIZE - 1) * CELL_SIZE, targetPosition.x + moveAmount);
				break;
			case 'Enter':
			case ' ':
				interactWithCurrentCell();
				return;
			case 'Escape':
				exitBuilding();
				return;
			default:
				return;
		}

		// Check if movement is valid (not into walls)
		const gridX = Math.floor(newX / CELL_SIZE);
		const gridY = Math.floor(newY / CELL_SIZE);
		const cell = buildingLayout[gridY]?.[gridX];

		if (cell && cell.type !== 'empty') {
			event.preventDefault();
			targetPosition = { x: newX, y: newY };
			animateToPosition(targetPosition);
		}
	}

	// Smooth movement animation
	function animateToPosition(target: { x: number; y: number }) {
		const duration = 200;
		const startTime = Date.now();
		const startPos = { ...heroPosition };

		function animate() {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easeProgress = 1 - Math.pow(1 - progress, 3);

			heroPosition.x = startPos.x + (target.x - startPos.x) * easeProgress;
			heroPosition.y = startPos.y + (target.y - startPos.y) * easeProgress;

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				heroPosition = { ...target };
			}
		}

		requestAnimationFrame(animate);
	}

	function interactWithCurrentCell() {
		const gridX = Math.floor(heroPosition.x / CELL_SIZE);
		const gridY = Math.floor(heroPosition.y / CELL_SIZE);
		const cell = buildingLayout[gridY]?.[gridX];

		if (cell?.type === 'room' && cell.room) {
			dispatch('selectRoom', cell.room);
		} else if (cell?.type === 'entrance') {
			exitBuilding();
		}
	}

	function exitBuilding() {
		dispatch('close');
	}

	function getCellColor(cell: BuildingCell): string {
		switch (cell.type) {
			case 'room':
				return getRoomColor(cell.room?.type || 'default');
			case 'corridor':
				return '#f1f5f9';
			case 'lobby':
				return '#e0f2fe';
			case 'entrance':
				return '#dbeafe';
			case 'empty':
				return '#374151';
			default:
				return '#374151';
		}
	}

	function getRoomColor(roomType: string) {
		const colors = {
			hr: '#3b82f6',
			library: '#8b5cf6',
			manufacturing: '#f59e0b',
			assembly: '#ef4444',
			inbound: '#10b981',
			outbound: '#06b6d4',
			helpdesk: '#f97316',
			training: '#84cc16',
			conference: '#ec4899',
			lobby: '#6366f1',
			cafeteria: '#f59e0b',
			office: '#3b82f6'
		};
		return colors[roomType] || '#6b7280';
	}

	function getRoomIcon(roomType: string) {
		const icons = {
			hr: '👥',
			library: '📚',
			manufacturing: '⚙️',
			assembly: '🔧',
			inbound: '📥',
			outbound: '📤',
			helpdesk: '🎧',
			training: '🎓',
			conference: '🏛️',
			lobby: '🏢',
			cafeteria: '🍽️',
			office: '💼'
		};
		return icons[roomType] || '🚪';
	}

	// Set up keyboard controls when expanded
	$: if (isExpanded) {
		document.addEventListener('keydown', handleBuildingMovement);
	} else {
		document.removeEventListener('keydown', handleBuildingMovement);
	}

	// Get current cell info for display
	$: currentCell = (() => {
		const gridX = Math.floor(heroPosition.x / CELL_SIZE);
		const gridY = Math.floor(heroPosition.y / CELL_SIZE);
		return buildingLayout[gridY]?.[gridX];
	})();
</script>

{#if isExpanded && currentMap}
	<div
		class="expanded-building"
		style="grid-column: {gridX + 1} / span 5; grid-row: {gridY + 1} / span 5;"
	>
		<div class="building-header">
			<h3>{currentMap.name}</h3>
			<div class="current-location">
				{#if currentCell?.type === 'room' && currentCell.room}
					<span class="location-icon">{getRoomIcon(currentCell.room.type)}</span>
					<span class="location-name">{currentCell.room.name}</span>
				{:else if currentCell?.type === 'lobby'}
					<span class="location-icon">🏢</span>
					<span class="location-name">Lobby</span>
				{:else if currentCell?.type === 'corridor'}
					<span class="location-icon">🚶</span>
					<span class="location-name">Corridor</span>
				{:else if currentCell?.type === 'entrance'}
					<span class="location-icon">🚪</span>
					<span class="location-name">Entrance</span>
				{/if}
			</div>
			<button class="close-btn" on:click={exitBuilding}>Exit</button>
		</div>

		<div class="building-interior">
			<!-- Building layout grid -->
			<div class="building-grid">
				{#each buildingLayout as row, y}
					{#each row as cell, x}
						<div
							class="building-cell"
							class:room={cell.type === 'room'}
							class:corridor={cell.type === 'corridor'}
							class:lobby={cell.type === 'lobby'}
							class:entrance={cell.type === 'entrance'}
							class:empty={cell.type === 'empty'}
							style="background-color: {getCellColor(cell)}"
						>
							{#if cell.type === 'room' && cell.room}
								<div class="room-content">
									<div class="room-icon">{getRoomIcon(cell.room.type)}</div>
									<div class="room-name">{cell.room.name}</div>
								</div>
							{:else if cell.type === 'entrance'}
								<div class="entrance-content">
									<div class="entrance-icon">🚪</div>
								</div>
							{:else if cell.type === 'lobby'}
								<div class="lobby-content">
									<div class="lobby-icon">🏢</div>
								</div>
							{/if}
						</div>
					{/each}
				{/each}

				<!-- Hero avatar -->
				<div class="hero-avatar" style="left: {heroPosition.x}px; top: {heroPosition.y}px;">
					<div class="avatar-circle"></div>
				</div>
			</div>
		</div>

		<div class="building-footer">
			<div class="movement-hint">Use WASD/Arrows to move • Enter to interact • Esc to exit</div>
		</div>
	</div>
{/if}

<style>
	.expanded-building {
		background: white;
		border-radius: 16px;
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
		border: 3px solid #3b82f6;
		z-index: 15;
		overflow: hidden;
		position: relative;
		animation: expand-in 0.4s ease-out;
	}

	@keyframes expand-in {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.building-header {
		background: #f8fafc;
		padding: 16px;
		border-bottom: 2px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.building-header h3 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		color: #1e293b;
	}

	.current-location {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #e0f2fe;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid #0891b2;
	}

	.location-icon {
		font-size: 18px;
	}

	.location-name {
		font-weight: 600;
		color: #0f172a;
	}

	.close-btn {
		background: #ef4444;
		color: white;
		border: none;
		padding: 10px 16px;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: #dc2626;
		transform: translateY(-1px);
	}

	.building-interior {
		padding: 20px;
	}

	.building-grid {
		position: relative;
		display: grid;
		grid-template-columns: repeat(8, 32px);
		grid-template-rows: repeat(8, 32px);
		gap: 1px;
		background: #334155;
		padding: 4px;
		border-radius: 8px;
		margin: 0 auto;
		width: fit-content;
	}

	.building-cell {
		position: relative;
		border-radius: 2px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.building-cell.room {
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	.building-cell.corridor {
		background: #f1f5f9 !important;
		border: 1px solid #e2e8f0;
	}

	.building-cell.lobby {
		background: #e0f2fe !important;
		border: 1px solid #0891b2;
	}

	.building-cell.entrance {
		background: #dbeafe !important;
		border: 1px solid #3b82f6;
	}

	.building-cell.empty {
		background: #374151 !important;
	}

	.room-content,
	.entrance-content,
	.lobby-content {
		text-align: center;
		color: white;
		padding: 2px;
	}

	.room-icon,
	.entrance-icon,
	.lobby-icon {
		font-size: 14px;
		line-height: 1;
	}

	.room-name {
		font-size: 8px;
		font-weight: 600;
		margin-top: 1px;
		line-height: 1;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.hero-avatar {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 10;
		pointer-events: none;
	}

	.avatar-circle {
		width: 20px;
		height: 20px;
		background: #f59e0b;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		animation: avatar-pulse 2s ease-in-out infinite;
	}

	@keyframes avatar-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	.building-footer {
		background: #1e293b;
		color: #94a3b8;
		padding: 12px 16px;
		text-align: center;
	}

	.movement-hint {
		font-size: 12px;
		font-weight: 500;
	}
</style>
