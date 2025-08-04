<!-- src/lib/components/nav/GameDynamicSidenav.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import AddHero from '$lib/features/game/components/AddHero.svelte';
	interface BuildingType {
		id: string;
		name: string;
		icon: string;
		size: { width: number; height: number };
	}

	export let width: number;
	export let buildingTypes: BuildingType[] = [];
	export let selectedBuildingType: string = '';
	export let isCreatingBuilding: boolean = false;
	export let onSelectBuildingType: (buildingType: BuildingType) => void;
	export let onCancelBuilding: () => void;

	const dispatch = createEventDispatcher();

	let activeTab: 'buildings' | 'heroes' | 'settings' = 'buildings';

	function setActiveTab(tab: 'buildings' | 'heroes' | 'settings') {
		activeTab = tab;
	}

	const slideTransition = (p0: HTMLDivElement, { duration = 180, delay = 0, direction = 1 }) => {
		return {
			delay,
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				return `
          transform: translateX(${(1 - eased) * 360 * direction}%) rotateX(${(1 - eased) * 360 * direction}deg);
          opacity: ${eased};
        `;
			}
		};
	};
</script>

<div
	class="game-side-menu"
	in:fly={{ x: -200, duration: 100 }}
	out:fly={{ x: -200, duration: 500 }}
	style="width: {width}px;"
	on:click|stopPropagation
	on:mousedown|stopPropagation
	on:mouseleave={() => dispatch('mouseleave')}
	role="complementary"
>
	<div class="tabs">
		<button class:active={activeTab === 'buildings'} on:click={() => setActiveTab('buildings')}>
			Buildings
		</button>
		<button class:active={activeTab === 'heroes'} on:click={() => setActiveTab('heroes')}>
			Heroes
		</button>
		<button class:active={activeTab === 'settings'} on:click={() => setActiveTab('settings')}>
			Settings
		</button>
	</div>

	<div class="content">
		{#if activeTab === 'buildings'}
			<div in:slideTransition={{ direction: -1 }} out:slideTransition={{ direction: 1 }}>
				<div class="building-section">
					<div class="toolbar-header">
						<h3>Buildings</h3>
						{#if isCreatingBuilding}
							<button class="cancel-btn" on:click={onCancelBuilding}>✕</button>
						{/if}
					</div>

					<div class="building-types">
						{#each buildingTypes as buildingType}
							<button
								class="building-btn"
								class:selected={selectedBuildingType === buildingType.id}
								class:creating={isCreatingBuilding && selectedBuildingType === buildingType.id}
								on:click={() => onSelectBuildingType(buildingType)}
								title="{buildingType.name} - Auto-creates rooms (3x3 each)"
							>
								<span class="building-icon">{buildingType.icon}</span>
								<span class="building-name">{buildingType.name}</span>
								<span class="building-rooms">
									{#if buildingType.size.width === 6}
										+5 rooms (3x3)
									{:else if buildingType.size.width === 9}
										+5 rooms (3x3)
									{:else}
										+rooms (3x3)
									{/if}
								</span>
							</button>
						{/each}
					</div>

					{#if isCreatingBuilding}
						<div class="creation-hint">
							<p>
								Click on the map to place your {buildingTypes.find(
									(bt) => bt.id === selectedBuildingType
								)?.name}
							</p>
							<p class="hint-small">Will auto-create lobby + rooms</p>
							<p class="hint-small">Press ESC to cancel</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'heroes'}
			<div in:slideTransition={{ direction: 1 }} out:slideTransition={{ direction: -1 }}>
				<div class="heroes-section">
					<AddHero />
					<div class="heroes-list">
						<!-- Add heroes management content here -->
						<p>Heroes management coming soon...</p>
					</div>
				</div>
			</div>
		{:else if activeTab === 'settings'}
			<div in:slideTransition={{ direction: 1 }} out:slideTransition={{ direction: -1 }}>
				<div class="settings-section">
					<!-- Add game settings content here -->
					<p>Game settings coming soon...</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);
	}

	.game-side-menu {
		position: fixed;
		display: flex;
		flex-direction: column;
		z-index: 1000;
		height: 100%;
		background-color: var(--primary-color);
		backdrop-filter: blur(3px);
		transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		overflow: hidden;
		perspective: 1000px;
	}

	.tabs {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
		width: 100%;
		height: 50px;
		margin-top: 1rem;
	}

	.tabs button {
		display: flex;
		width: 33.33%;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		border: none;
		cursor: pointer;
		color: var(--text-color);
		font-size: 14px;
		background-color: transparent;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		transform: scale(1);
	}

	.tabs button:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.tabs button.active {
		padding: 20px;
		border-bottom: 2px solid #ffffff;
	}

	.content {
		position: relative;
		height: calc(100% - 50px);
		overflow: auto;
		padding: 1rem;
	}

	.content > div {
		position: absolute;
		width: calc(100% - 2rem);
		height: calc(100% - 2rem);
		backface-visibility: hidden;
	}

	/* Building section styles */
	.building-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.toolbar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--text-color);
		margin-bottom: 1rem;
	}

	.toolbar-header h3 {
		margin: 0;
		font-size: 1.2rem;
	}

	.cancel-btn {
		background: rgba(255, 0, 0, 0.2);
		color: var(--text-color);
		border: 1px solid rgba(255, 0, 0, 0.5);
		border-radius: 50%;
		width: 30px;
		height: 30px;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover {
		background: rgba(255, 0, 0, 0.4);
	}

	.building-types {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.building-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid transparent;
		border-radius: 8px;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
	}

	.building-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.building-btn.selected {
		border-color: #4caf50;
		background: rgba(76, 175, 80, 0.2);
	}

	.building-btn.creating {
		border-color: #ff9800;
		background: rgba(255, 152, 0, 0.2);
		animation: pulse 1s infinite;
	}

	.building-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.building-name {
		font-weight: bold;
		margin-bottom: 0.25rem;
	}

	.building-rooms {
		font-size: 0.8rem;
		opacity: 0.8;
	}

	.creation-hint {
		background: rgba(255, 152, 0, 0.1);
		border: 1px solid rgba(255, 152, 0, 0.3);
		border-radius: 8px;
		padding: 1rem;
		color: var(--text-color);
		text-align: center;
	}

	.creation-hint p {
		margin: 0.5rem 0;
	}

	.hint-small {
		font-size: 0.8rem;
		opacity: 0.8;
	}

	/* Heroes section styles */
	.heroes-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--text-color);
	}

	.heroes-list {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 1rem;
		text-align: center;
	}

	/* Settings section styles */
	.settings-section {
		color: var(--text-color);
		text-align: center;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 1rem;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
		}
	}
</style>
