<!-- src/routes/game/navigator/Hero.svelte -->
<script lang="ts">
  import { pocketbaseUrl } from '$lib/pocketbase';
  import type { GameHero as HeroType } from '$lib/types/types.game';
  
  export let hero: HeroType;
  export let isCurrentUser: boolean = false;
  export let GRID_SIZE: number;
  export let pixelToGrid: (pixel: number) => number;
  
  let isHovered = false;
  
  // Convert hero position to grid coordinates and then back to centered pixel position
  $: gridX = pixelToGrid(hero.position.x);
  $: gridY = pixelToGrid(hero.position.y);
  $: pixelX = gridX * GRID_SIZE + GRID_SIZE / 2;
  $: pixelY = gridY * GRID_SIZE + GRID_SIZE / 2;
  
  // Get user info if expanded hero
  $: userInfo = hero.expand?.user;
</script>

<div 
  class="hero-avatar"
  style="grid-column: {gridX + 1}; grid-row: {gridY + 1};"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  class:is-current-user={isCurrentUser}
>
  <!-- Hero circle -->
  <div class="hero-container">
    <!-- Main hero circle -->
    <div 
      class="hero-circle"
      class:current-user={isCurrentUser}
    >
      <!-- User image or initials -->
      {#if userInfo?.avatar}
        <img 
          src={`${pocketbaseUrl}/api/files/users/${userInfo.id}/${userInfo.avatar}?thumb=100x100`}
          alt={userInfo.username}
          class="hero-image"
        />
      {:else if userInfo?.username}
        <div class="hero-initials" class:current-user-bg={isCurrentUser}>
          {userInfo.username.charAt(0).toUpperCase()}
        </div>
      {:else}
        <div class="hero-initials default">
          ?
        </div>
      {/if}
    </div>
    
    <!-- Status indicators -->
    <div class="status-indicators">
      <!-- Online status -->
      <div class="online-indicator"></div>
      
      <!-- Current location indicator -->
      {#if hero.currentRoom}
        <div class="location-tooltip" class:visible={isHovered}>
          📍 In room
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Username label -->
  <div class="username-label">
    <div class="username-text">
      {userInfo?.username || 'Hero'}
      {#if isCurrentUser}
        <span class="you-text">(You)</span>
      {/if}
    </div>
  </div>
  
  <!-- Hover tooltip with details -->
  {#if isHovered && !isCurrentUser}
    <div class="hero-tooltip">
      <div class="tooltip-content">
        <div class="tooltip-name">{userInfo?.username || 'Unknown Hero'}</div>
        {#if userInfo?.name}
          <div class="tooltip-realname">{userInfo.name}</div>
        {/if}
        <div class="tooltip-lastseen">
          Last seen: {new Date(hero.lastSeen).toLocaleTimeString()}
        </div>
        <div class="tooltip-arrow"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .hero-avatar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    cursor: pointer;
    /* Smooth grid transition */
    transition: grid-column 0.3s ease, grid-row 0.3s ease;
  }
  
  .hero-avatar:hover {
    transform: scale(1.1);
  }
  
  .hero-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .hero-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid #9ca3af;
    overflow: hidden;
    transition: all 0.2s;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .hero-circle.current-user {
    border-color: #3b82f6;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }
  
  .hero-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .hero-initials {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 18px;
  }
  
  .hero-initials.current-user-bg {
    background-color: #3b82f6;
  }
  
  .hero-initials.default {
    background-color: #6b7280;
  }
  
  .status-indicators {
    position: absolute;
    bottom: -4px;
    right: -4px;
    pointer-events: none;
  }
  
  .online-indicator {
    width: 16px;
    height: 16px;
    background-color: #10b981;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
  }
  
  .location-tooltip {
    position: absolute;
    top: -32px;
    right: -8px;
    font-size: 11px;
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .location-tooltip.visible {
    opacity: 1;
  }
  
  .username-label {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    pointer-events: none;
  }
  
  .username-text {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    background: white;
    padding: 4px 8px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    text-align: center;
    white-space: nowrap;
    border: 1px solid #e5e7eb;
  }
  
  .you-text {
    color: #3b82f6;
    font-weight: 600;
  }
  
  .hero-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    z-index: 30;
  }
  
  .tooltip-content {
    background: #1f2937;
    color: white;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    white-space: nowrap;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .tooltip-name {
    font-weight: 600;
  }
  
  .tooltip-realname {
    font-size: 12px;
    opacity: 0.75;
    margin-top: 2px;
  }
  
  .tooltip-lastseen {
    font-size: 12px;
    margin-top: 4px;
    opacity: 0.8;
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
  
  .is-current-user .hero-circle {
    animation: float 3s ease-in-out infinite;
  }
  
  /* Grid movement animation */
  .hero-avatar {
    animation: grid-move 0.3s ease-out;
  }
  
  @keyframes float {
    0%, 100% { 
      transform: translateY(0);
    }
    50% { 
      transform: translateY(-3px);
    }
  }
  
  @keyframes grid-move {
    0% { 
      transform: scale(0.9);
    }
    50% {
      transform: scale(1.05);
    }
    100% { 
      transform: scale(1);
    }
  }
</style>