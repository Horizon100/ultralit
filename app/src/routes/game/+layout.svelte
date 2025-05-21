<script lang="ts">
    import { get } from 'svelte/store';
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import type { GameState } from '$lib/types/types.game';
    import { gameService } from '$lib/stores/gameStore';
    import { goto } from '$app/navigation';
    import GameInstructions from '$lib/features/game/components/GameInstructions.svelte';

  export let data;
  
  export const gameState = writable<GameState>({
    currentView: 'map',
    currentMap: null,
    currentRoom: null,
    currentTable: null,
    currentDialog: null,
    heroPawn: null,
    viewportPosition: { x: 0, y: 0 },
    zoomLevel: 1,
    isLoading: false
  });
  
  let gameInstructions: GameInstructions;
    
  function setupKeyboardShortcuts() {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key.toLowerCase()) {
        case 'm':
          event.preventDefault();
          goto('/game/navigator');
          break;
        case 'escape':
          event.preventDefault();
          leaveCurrentLocation();
          break;
        case '?':
          event.preventDefault();
        if (gameInstructions && gameInstructions.toggleInstructions) {
            gameInstructions.toggleInstructions();
        }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }
  
  async function leaveCurrentLocation() {
    const $gameState = get(gameState);
    if ($gameState.heroPawn && data.user) {
      await gameService.leaveCurrentLocation(data.user.id);
      if ($gameState.currentView === 'dialog') {
        if ($gameState.currentTable) {
          goto(`/game/room/${$gameState.currentRoom?.id}`);
        } else {
          goto('/game/navigator');
        }
      } else if ($gameState.currentView === 'room') {
        goto('/game/navigator');
      }
    }
  }
  onMount(async () => {
    if (browser && data.user) {
      await gameService.initializeGame(data.user.id);
      setupKeyboardShortcuts();
    }
  });

  
  $: currentPath = $page.route.id;
</script>

<div class="game-wrapper">
  <!-- Game HUD -->
  <div class="game-hud">
    <div class="hud-content">
      <!-- Navigation breadcrumb -->
      <div class="breadcrumb-container">
        <nav class="breadcrumb-nav">
          <span class="breadcrumb-item current">Game</span>
          {#if $gameState.currentMap}
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">{$gameState.currentMap.name}</span>
          {/if}
          {#if $gameState.currentRoom}
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">{$gameState.currentRoom.name}</span>
          {/if}
          {#if $gameState.currentTable}
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">{$gameState.currentTable.name}</span>
          {/if}
        </nav>
      </div>
      
      <!-- Mini-map and controls -->
      <div class="game-controls">
        {#if currentPath !== '/game/navigator'}
          <button class="btn-secondary" on:click={() => goto('/game/navigator')}>
            Return to Map
          </button>
        {/if}
        
        {#if $gameState.heroPawn}
          <div class="user-status">
            Position: ({$gameState.heroPawn.position.x}, {$gameState.heroPawn.position.y})
          </div>
        {/if}
      </div>
    </div>
  </div>
  <main class="game-content">
    <slot />
  </main>
  
  <!-- Loading overlay -->
  {#if $gameState.isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading game...</p>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		//   font-family: 'Source Code Pro', monospace;
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}
	// main {
	// 	background: var(--bg-gradient);
	// 	color: var(--text-color);
	// 	width: 100%;
	// 	height: 100%;
	// 	left: 0;
    //     right: 0;
	// 	top: 0;
	// 	bottom: 0;
	// 	position: fixed;
	// 	display: flex;
	// 	flex-grow: 1;
	// }
    // main {
    //     background: var(--bg-gradient);
    //     		height: 100vh !important;
    //             display: flex;
    //             position: fixed;
    //             left: 0;
    //             right: 0;


    // }
.game-wrapper {
    width: calc(100% - 7rem);
    margin-top: 3rem;
    margin-left: 4rem;
    margin-bottom: 4rem;
    padding: 1rem;
    overflow: hidden;
    border-radius: 1rem;
    background: var(--bg-gradient);
    color: var(--text-color);
    font-family: var(--font-family);
  }
  
  .game-hud {
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 1rem;

    backdrop-filter: blur(5px);
    border-bottom: 1px solid var(--line-color);
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
    color: var(--primary-color);
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
    margin-top: 4rem;
    height: calc(100% - 4rem);
  }
  
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  
  .loading-spinner {
    background: var(--bg-color);
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
    to { transform: rotate(360deg); }
  }
</style>