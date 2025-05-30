<!-- src/routes/game/navigator/MapView.svelte -->
<script lang="ts">
	import { gameStore, gameRoomStore } from '$lib/stores/gameStore';
	import Room from './Room.svelte';
	import type { GameBuilding, GameRoom as GameRoomType } from '$lib/types/types.game';

	export let container: GameBuilding;
	export let gridSize: number;
	export let data: any;
	export let isInsideBuilding: boolean;

	let isHovered = false;
	let isActive = false;
	let isExpanded = false;

	// Convert building position to grid coordinates
	$: gridX = pixelToGrid(container.position.x);
	$: gridY = pixelToGrid(container.position.y);

	// Get rooms for this map container
	$: rooms = $gameRoomStore.filter((room) => room.building === container.id);

	function getIconForType(type: GameBuilding['type']) {
		switch (type) {
			case 'office':
				return '🏢';
			case 'factory':
				return '🏭';
			case 'logistics':
				return '📦';
			case 'support':
				return '🆘';
			default:
				return '🏢';
		}
	}

	function getColorForType(type: GameBuilding['type']) {
		switch (type) {
			case 'office':
				return 'office';
			case 'factory':
				return 'factory';
			case 'logistics':
				return 'logistics';
			case 'support':
				return 'support';
			default:
				return 'default';
		}
	}

	function getRoomIcon(roomType: string) {
		switch (roomType) {
			case 'hr':
				return '👥';
			case 'library':
				return '📚';
			case 'manufacturing':
				return '⚙️';
			case 'assembly':
				return '🔧';
			case 'inbound':
				return '📥';
			case 'outbound':
				return '📤';
			case 'helpdesk':
				return '🎧';
			case 'training':
				return '🎓';
			default:
				return '🚪';
		}
	}
	function pixelToGrid(pixel: number): number {
		return Math.floor(pixel / gridSize);
	}
	async function enterBuilding() {
		isExpanded = true;
		isInsideBuilding = true;
	}

	function handleRoomSelection(event: CustomEvent) {
		const room = event.detail;
		console.log('Selected room:', room);
		isExpanded = false;
		isInsideBuilding = false;
		// TODO: Enter specific room
	}

	function handleCloseBuilding() {
		isExpanded = false;
		isInsideBuilding = false;
	}

	$: isActive = $gameStore.currentBuilding?.id === container.id;
</script>

<div
	class="map-container"
	style="grid-column: {gridX + 1} / span 2; grid-row: {gridY + 1} / span 2;"
	on:mouseenter={() => (isHovered = true)}
	on:mouseleave={() => (isHovered = false)}
	on:click={enterBuilding}
	class:hovered={isHovered}
	class:active={isActive}
	class:expanded={isExpanded}
>
	<!-- Building structure -->
	<div class="building-main">
		<!-- Main building body -->
		<div class="building-body {getColorForType(container.buildingType)}">
			<div class="building-roof"></div>
			<div class="building-entrance"></div>
		</div>

		<!-- Building details -->
		<div class="building-details">
			<div class="building-icon">{getIconForType(container.buildingType)}</div>
			<div class="building-name">{container.name}</div>
		</div>

		<!-- Room indicators -->
		{#if rooms.length > 0}
			<div class="room-indicators">
				{#each rooms.slice(0, 4) as room}
					<div class="room-indicator" title={room.name}>
						<span class="room-icon">{getRoomIcon('room')}</span>
					</div>
				{/each}
				{#if rooms.length > 4}
					<div class="room-indicator more">+{rooms.length - 4}</div>
				{/if}
			</div>
		{/if}

		<!-- Activity indicator -->
		{#if rooms.length > 0}
			<div class="activity-indicator"></div>
		{/if}
	</div>

	<!-- Hover tooltip -->
	{#if isHovered}
		<div class="tooltip">
			<div class="tooltip-content">
				<div class="tooltip-title">{container.name}</div>
				<div class="tooltip-description">{container.description}</div>
				<div class="tooltip-rooms">
					{rooms.length} room{rooms.length !== 1 ? 's' : ''}
				</div>
				{#if rooms.length > 0}
					<div class="tooltip-room-list">
						{#each rooms as room}
							<div class="tooltip-room">
								<span class="tooltip-room-icon">{getRoomIcon('room')}</span>
								<span class="tooltip-room-name">{room.name}</span>
							</div>
						{/each}
					</div>
				{/if}
				<div class="tooltip-arrow"></div>
			</div>
		</div>
	{/if}
</div>

<Room
	currentMap={container}
	{isExpanded}
	{data}
	{gridSize}
	{pixelToGrid}
	{gridX}
	{gridY}
	on:selectRoom={handleRoomSelection}
	on:close={handleCloseBuilding}
/>
<style lang="scss">

	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}		
	.map-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.map-container.expanded {
		z-index: 20;
		pointer-events: none;
	}

	.map-container.expanded .building-main {
		display: none;
	}

	.building-main {
		width: 120px;
		height: 120px;
		position: relative;
		transition: transform 0.2s ease;
	}

	.building-body {
		width: 100%;
		height: 100%;
		border-radius: 12px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.building-body.office {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
	}

	.building-body.factory {
		background: linear-gradient(135deg, #8b5cf6, #7c3aed);
	}

	.building-body.logistics {
		background: linear-gradient(135deg, #f97316, #ea580c);
	}

	.building-body.support {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	.building-body.default {
		background: linear-gradient(135deg, #6b7280, #4b5563);
	}

	.building-roof {
		height: 15px;
		background: rgba(55, 65, 81, 0.8);
		border-radius: 12px 12px 0 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.building-entrance {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 24px;
		height: 12px;
		background-color: #1f2937;
		border-radius: 0 0 8px 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-top: none;
	}

	.building-details {
		position: absolute;
		inset: 15px 8px 12px 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		pointer-events: none;
		text-align: center;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.building-icon {
		font-size: 28px;
		margin-bottom: 2px;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}

	.building-name {
		font-size: 9px;
		font-weight: 700;
		line-height: 1.1;
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.room-indicators {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 3px;
		background: rgba(255, 255, 255, 0.95);
		padding: 6px 8px;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(8px);
	}

	.room-indicator {
		width: 18px;
		height: 18px;
		background: #f8fafc;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		border: 1px solid rgba(0, 0, 0, 0.05);
		transition: all 0.2s ease;
	}

	.room-indicator:hover {
		transform: scale(1.1);
		background: #e2e8f0;
	}

	.room-indicator.more {
		background: #3b82f6;
		color: white;
		font-size: 8px;
		font-weight: bold;
		border-color: #2563eb;
	}

	.room-icon {
		font-size: 11px;
	}

	.activity-indicator {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 14px;
		height: 14px;
		background: #10b981;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.2);
		}
	}

	.map-container:hover .building-main {
		transform: scale(1.1);
	}

	.map-container:hover .building-body {
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
	}

	.map-container.active .building-main {
		transform: scale(1.15);
	}

	.map-container.active .building-body {
		box-shadow: 0 0 24px 8px rgba(59, 130, 246, 0.6);
		border-color: rgba(59, 130, 246, 0.8);
	}

	.tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 12px;
		z-index: 30;
	}

	.tooltip-content {
		background: #1f2937;
		color: white;
		padding: 16px;
		border-radius: 12px;
		min-width: 200px;
		max-width: 300px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.tooltip-title {
		font-weight: 700;
		font-size: 16px;
		margin-bottom: 8px;
		color: #f9fafb;
	}

	.tooltip-description {
		font-size: 13px;
		opacity: 0.85;
		margin-bottom: 12px;
		line-height: 1.4;
		color: #d1d5db;
	}

	.tooltip-rooms {
		font-size: 12px;
		color: #9ca3af;
		margin-bottom: 10px;
		font-weight: 500;
	}

	.tooltip-room-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px;
	}

	.tooltip-room {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		padding: 4px 0;
		color: #e5e7eb;
	}

	.tooltip-room-icon {
		font-size: 14px;
	}

	.tooltip-room-name {
		font-size: 11px;
		opacity: 0.9;
	}

	.tooltip-arrow {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid #1f2937;
	}
</style>
