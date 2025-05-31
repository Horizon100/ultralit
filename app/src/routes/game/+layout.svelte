<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import type { GameState } from '$lib/types/types.game';
	import { gameStore, gameService } from '$lib/stores/gameStore';
	import { goto } from '$app/navigation';
	import AddHero from '$lib/features/game/components/AddHero.svelte'; 

	export let data;


	function setupKeyboardShortcuts() {
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
				return;
			}

			switch (event.key.toLowerCase()) {
				case 'm':
					event.preventDefault();
					goto('/game');
					break;
				case 'escape':
					event.preventDefault();
					leaveCurrentLocation();
					break;
				case '?':
					event.preventDefault();

					break;
			}
		};

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	}

	async function leaveCurrentLocation() {
		const $gameStore = get(gameStore); // Changed from gameState to gameStore
		if ($gameStore.heroPawn && data.user) {
			await gameService.leaveCurrentLocation(data.user.id);
			if ($gameStore.currentView === 'dialog') {
				if ($gameStore.currentTable && $gameStore.currentRoom) {
					goto(`/game/room/${$gameStore.currentRoom.id}`);
				} else {
					goto('/game');
				}
			} else if ($gameStore.currentView === 'table') {
				if ($gameStore.currentBuilding) {
					goto(`/game/buildings/${$gameStore.currentBuilding.id}`);
				} else {
					goto('/game');
				}
			} else if ($gameStore.currentView === 'room') {
				if ($gameStore.currentBuilding) {
					goto(`/game/buildings/${$gameStore.currentBuilding.id}`);
				} else {
					goto('/game');
				}
			}
		}
	}


	onMount(async () => {
		if (browser && data.user) {
			await gameService.initializeGame(data.user.id);
			
			// Add debug logging
			gameStore.subscribe(state => {
				console.log('[DEBUG] GameStore state:', {
					heroPawn: state.heroPawn,
					currentOrganization: state.currentOrganization,
					heroCurrentOrg: state.heroPawn?.currentOrganization
				});
			});
			
			setupKeyboardShortcuts();
		}
	});


	$: currentPath = $page.route.id;
</script>

<!-- Simplified Game HUD - only show when not on main game page -->
{#if currentPath !== '/game'}
	<div class="game-hud">
		<div class="hud-content">
			<!-- Navigation breadcrumb -->
			<div class="breadcrumb-container">
				<nav class="breadcrumb-nav">
					<button class="btn-secondary" on:click={() => goto('/game')}>
						Back
					</button>

					{#if $gameStore.currentOrganization}
						<span class="breadcrumb-separator">/</span>
						<span class="breadcrumb-item current">{$gameStore.currentOrganization.name}</span>
					{/if}

					{#if $gameStore.currentBuilding}
						<span class="breadcrumb-separator">/</span>
						<span class="breadcrumb-item current">{$gameStore.currentBuilding.name}</span>
					{/if}
					{#if $gameStore.currentRoom}
						<span class="breadcrumb-separator">/</span>
						<span class="breadcrumb-item current">{$gameStore.currentRoom.name}</span>
					{/if}
					{#if $gameStore.currentTable}
						<span class="breadcrumb-separator">/</span>
						<span class="breadcrumb-item current">{$gameStore.currentTable.name}</span>
					{/if}
				</nav>
			</div>

			<!-- Mini-map and controls -->
			<div class="game-controls">
					<AddHero />

				{#if $gameStore.heroPawn}
					<div class="user-status">
						Position: ({$gameStore.heroPawn.position.x}, {$gameStore.heroPawn.position.y})
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<main class="game-content" class:no-hud={currentPath === '/game'}>
	<slot />
</main>

<!-- Loading overlay -->
{#if $gameStore.isLoading}
	<div class="loading-overlay">
		<div class="loading-spinner">
			<div class="spinner"></div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;
	
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

	.game-hud {
		position: fixed;
		top: 3rem;
		left: 4.5rem;
		right: 3rem;
		z-index: 50;
		padding: 0.5rem;
		backdrop-filter: blur(5px);

		border-radius: 1rem 1rem 0 0;
	}

	.hud-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.breadcrumb-container {
		background: var(--bg-color);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--line-color);
	}

	.breadcrumb-nav {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--placeholder-color);
	}

	.breadcrumb-item.current {
		color: var(--text-color);
	}

	.breadcrumb-separator {
		margin: 0 0.5rem;
	}

	.game-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.btn-secondary {
		background: var(--primary-color);
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
		font-family: var(--font-family);
	}

	.btn-secondary:hover {
		background: var(--secondary-color);
	}

	.user-status {
		background: var(--tertiary-color);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: monospace;
	}

	.game-content {
		width: 100%;
		margin-top: 3rem;
		margin-left: 0rem;
		margin-right: 0;
		margin-bottom: 4rem;
		padding: 1rem;
		overflow: hidden;
		border-radius: 1rem;
		color: var(--text-color);
		font-family: var(--font-family);
		height: calc(100vh - 10rem);

		&.no-hud {
			padding-top: 1rem;
		}
	}

	.loading-overlay {
		position: fixed;
		width: 100vw;
		height: 100vh;
		inset: 0;
		// background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.loading-spinner {
		background: var(--bg-color);
		position: absolute;
		padding: 1.5rem;
		border-radius: 8px;
		text-align: center;
	}

	.spinner {
		width: 3rem;
		height: 3rem;
		border: 4px solid var(--line-color);
		border-top: 4px solid var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	</style>