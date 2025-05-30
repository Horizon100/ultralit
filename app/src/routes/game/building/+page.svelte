<!-- src/lib/features/game/components/BuildingView.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { GameBuilding } from '$lib/types/types.game';

	export let building: GameBuilding;
	export let gridSize: number;

	const dispatch = createEventDispatcher();

	let isHovered = false;

	// Calculate building position and size in pixels
	$: buildingStyle = `
		left: ${building.position.x}px;
		top: ${building.position.y}px;
		width: ${building.size.width * gridSize}px;
		height: ${building.size.height * gridSize}px;
	`;

	function handleClick() {
		dispatch('enterBuilding', building);
	}

	function getBuildingIcon(name: string): string {
		const nameLower = name.toLowerCase();
		if (nameLower.includes('office') || nameLower.includes('admin')) return '🏢';
		if (nameLower.includes('factory') || nameLower.includes('manufacturing')) return '🏭';
		if (nameLower.includes('warehouse') || nameLower.includes('storage')) return '📦';
		if (nameLower.includes('lab') || nameLower.includes('research')) return '🔬';
		if (nameLower.includes('cafe') || nameLower.includes('food')) return '☕';
		if (nameLower.includes('gym') || nameLower.includes('fitness')) return '💪';
		if (nameLower.includes('library')) return '📚';
		if (nameLower.includes('meeting') || nameLower.includes('conference')) return '👥';
		if (nameLower.includes('welcome') || nameLower.includes('lobby')) return '🏛️';
		return '🏢';
	}

	function getBuildingColor(name: string): string {
		const nameLower = name.toLowerCase();
		if (nameLower.includes('office') || nameLower.includes('admin')) return '#3b82f6';
		if (nameLower.includes('factory') || nameLower.includes('manufacturing')) return '#8b5cf6';
		if (nameLower.includes('warehouse') || nameLower.includes('storage')) return '#f97316';
		if (nameLower.includes('lab') || nameLower.includes('research')) return '#06b6d4';
		if (nameLower.includes('cafe') || nameLower.includes('food')) return '#f59e0b';
		if (nameLower.includes('gym') || nameLower.includes('fitness')) return '#ef4444';
		if (nameLower.includes('library')) return '#10b981';
		if (nameLower.includes('meeting') || nameLower.includes('conference')) return '#6366f1';
		if (nameLower.includes('welcome') || nameLower.includes('lobby')) return '#14b8a6';
		return '#6b7280';
	}
</script>

<div
	class="building-container"
	style={buildingStyle}
	on:click={handleClick}
	on:mouseenter={() => isHovered = true}
	on:mouseleave={() => isHovered = false}
	class:hovered={isHovered}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
	<!-- Building structure -->
	<div 
		class="building-body"
		style="--building-color: {getBuildingColor(building.name)};"
	>
		<!-- Building roof -->
		<div class="building-roof"></div>
		
		<!-- Building main area -->
		<div class="building-main">
			<div class="building-icon">
				{getBuildingIcon(building.name)}
			</div>
			<div class="building-name">
				{building.name}
			</div>
		</div>
		
		<!-- Building entrance -->
		<div class="building-entrance"></div>
	</div>

	<!-- Room count indicator -->
	{#if building.rooms && building.rooms.length > 0}
		<div class="room-count">
			{building.rooms.length}
		</div>
	{/if}

	<!-- Activity indicator -->
	{#if building.isActive}
		<div class="activity-indicator"></div>
	{/if}

	<!-- Hover tooltip -->
	{#if isHovered}
		<div class="building-tooltip">
			<div class="tooltip-content">
				<div class="tooltip-title">{building.name}</div>
				{#if building.description}
					<div class="tooltip-description">{building.description}</div>
				{/if}
				<div class="tooltip-stats">
					<div class="tooltip-stat">
						<span class="stat-label">Rooms:</span>
						<span class="stat-value">{building.rooms?.length || 0}</span>
					</div>
					<div class="tooltip-stat">
						<span class="stat-label">Tables:</span>
						<span class="stat-value">{building.tables?.length || 0}</span>
					</div>
					<div class="tooltip-stat">
						<span class="stat-label">Size:</span>
						<span class="stat-value">{building.size.width}×{building.size.height}</span>
					</div>
				</div>
				<div class="tooltip-action">Click to enter</div>
			</div>
			<div class="tooltip-arrow"></div>
		</div>
	{/if}
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.building-container {
		position: absolute;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 10;
	}

	.building-container:hover {
		transform: scale(1.05);
		z-index: 15;
	}

	.building-container.hovered {
		filter: brightness(1.1);
	}

	.building-body {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, var(--building-color), color-mix(in srgb, var(--building-color) 80%, #000));
		border-radius: 8px;
		box-shadow: 
			0 4px 8px rgba(0, 0, 0, 0.2),
			0 1px 3px rgba(0, 0, 0, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		overflow: hidden;
		position: relative;
		transition: all 0.2s ease;
	}

	.building-container:hover .building-body {
		box-shadow: 
			0 8px 16px rgba(0, 0, 0, 0.3),
			0 2px 6px rgba(0, 0, 0, 0.15);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.building-roof {
		height: 12px;
		background: linear-gradient(135deg, #374151, #1f2937);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		position: relative;
	}

	.building-roof::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 50%;
		transform: translateX(-50%);
		width: 60%;
		height: 2px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 1px;
	}

	.building-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 8px;
		text-align: center;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		height: calc(100% - 24px);
	}

	.building-icon {
		font-size: clamp(16px, 4vw, 32px);
		margin-bottom: 4px;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}

	.building-name {
		font-size: clamp(8px, 2vw, 12px);
		font-weight: 600;
		line-height: 1.1;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.building-entrance {
		height: 12px;
		background: #1f2937;
		position: relative;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.building-entrance::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 20px;
		height: 8px;
		background: #000;
		border-radius: 0 0 4px 4px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-top: none;
	}

	.room-count {
		position: absolute;
		top: -8px;
		right: -8px;
		background: #10b981;
		color: white;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 600;
		border: 2px solid white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.activity-indicator {
		position: absolute;
		top: -4px;
		left: -4px;
		width: 12px;
		height: 12px;
		background: #22c55e;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.2);
		}
	}

	.building-tooltip {
		position: absolute;
		bottom: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		pointer-events: none;
	}

	.tooltip-content {
		background: #1f2937;
		color: white;
		padding: 12px;
		border-radius: 8px;
		min-width: 200px;
		max-width: 280px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.tooltip-title {
		font-weight: 600;
		font-size: 14px;
		margin-bottom: 6px;
		color: #f9fafb;
	}

	.tooltip-description {
		font-size: 12px;
		opacity: 0.85;
		margin-bottom: 8px;
		line-height: 1.4;
		color: #d1d5db;
	}

	.tooltip-stats {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 8px;
	}

	.tooltip-stat {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
	}

	.stat-label {
		color: #9ca3af;
	}

	.stat-value {
		color: #e5e7eb;
		font-family: monospace;
		font-weight: 500;
	}

	.tooltip-action {
		font-size: 11px;
		color: #60a5fa;
		text-align: center;
		font-weight: 500;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.tooltip-arrow {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-top: 6px solid #1f2937;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.building-container:hover {
			transform: scale(1.02);
		}

		.tooltip-content {
			min-width: 160px;
			max-width: 220px;
			padding: 10px;
		}

		.tooltip-title {
			font-size: 13px;
		}

		.tooltip-description {
			font-size: 11px;
		}
	}
</style>