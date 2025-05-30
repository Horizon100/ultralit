<!-- src/lib/features/game/components/Hero.svelte -->
<script lang="ts">
	import { pocketbaseUrl } from '$lib/pocketbase';
	import type { GameHero } from '$lib/types/types.game';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';

	export let hero: GameHero;
	export let isCurrentUser: boolean = false;
	export let gridSize: number = 64;
  	export let direction: 'left' | 'right' | 'up' | 'down' = 'down'; 

	let isHovered = false;

	function getHeroColor(): string {
		if (isCurrentUser) return '#3b82f6';
		if (isOnline) return '#10b981'; 
		return '#6b7280';
	}

	function getLocationText(): string {
		if (hero.currentTable) return 'At table';
		if (hero.currentRoom) return 'In room';
		if (hero.currentBuilding) return 'In building';
		return 'In world';
	}

	$: heroStyle = `
		left: ${hero.position.x - gridSize/2}px;
		top: ${hero.position.y - gridSize/2}px;
		width: ${gridSize}px;
		height: ${gridSize}px;
	`;

	// Get user info
	$: userInfo = hero.expand?.user;
	$: userName = userInfo?.username || userInfo?.name || 'Hero';
	$: userAvatarUrl = userInfo ? getAvatarUrl(userInfo) : '';

	// Hero status
	$: isOnline = hero.lastSeen && new Date(hero.lastSeen).getTime() > Date.now() - 300000; // 5 minutes


</script>

<div
	class="hero-container" class:flipped={direction === 'left'}
	class:current-user={isCurrentUser}
	class:moving={hero.isMoving}
	class:online={isOnline}
	style={heroStyle}
	on:mouseenter={() => (isHovered = true)}
	on:mouseleave={() => (isHovered = false)}
>
	<!-- Hero avatar circle -->
	<div class="hero-circle" style="--hero-color: {getHeroColor()};" >
		{#if userAvatarUrl}
			<img 
				src={`${userAvatarUrl}?thumb=100x100`} 
				alt={userName} 
				class="hero-image" 
			/>
		{:else}
			<div class="hero-initials">
				{userName.charAt(0).toUpperCase()}
			</div>
		{/if}
	</div>
	<!-- Status indicators -->
	<div class="status-indicators">
		{#if isCurrentUser}
			<div class="indicator current-indicator" title="You"></div>
		{:else if isOnline}
			<div class="indicator online-indicator" title="Online"></div>
		{:else}
			<div class="indicator offline-indicator" title="Offline"></div>
		{/if}

		{#if hero.isMoving}
			<div class="indicator moving-indicator" title="Moving">
				<div class="moving-dots">
					<span></span>
					<span></span>
					<span></span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Username label -->
	<div class="username-label">
		<div class="username-text">
			{userName}
			{#if isCurrentUser}
				<span class="you-text">(You)</span>
			{/if}
		</div>
	</div>

	<!-- Location indicator for current user -->
	{#if isCurrentUser && (hero.currentRoom || hero.currentBuilding || hero.currentTable)}
		<div class="location-indicator">
			{getLocationText()}
		</div>
	{/if}

	<!-- Hover tooltip for other users -->
	{#if isHovered && !isCurrentUser}
		<div class="hero-tooltip">
			<div class="tooltip-content">
				<div class="tooltip-name">{userName}</div>
				{#if userInfo?.name && userInfo.name !== userInfo.username}
					<div class="tooltip-realname">{userInfo.name}</div>
				{/if}
				<div class="tooltip-status">
					{isOnline ? 'Online' : 'Offline'}
				</div>
				<div class="tooltip-location">
					{getLocationText()}
				</div>
				<div class="tooltip-lastseen">
					Last seen: {new Date(hero.lastSeen).toLocaleTimeString()}
				</div>
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
	.hero-container {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 20;
		transition: all 0.3s ease;
		cursor: pointer;
	}
.hero-container.flipped .hero-image,
.hero-container.flipped .hero-initials {
  transform: scaleX(-1);
}

.hero-image, .hero-initials {
  transition: transform 0.15s ease;
}

/* Adjust the moving animation to work with flipping */
.hero-container.moving .hero-image,
.hero-container.moving .hero-initials {

  animation: bounceAndFlip 0.6s ease-in-out infinite;
}

@keyframes bounceAndFlip {
  0%, 100% {
    transform: translateX(4px) scaleX(var(--flip-factor, 1));
	  transform: scaleX(1);

}
  50% {
    transform: translateY(-4px) scaleX(var(--flip-factor, 1));
  
}
}
	.hero-container.moving {
		transition: all 0.8s ease;

	}

	.hero-container.current-user {
		z-index: 25;
	}

	.hero-container:hover {
		transform: scale(1.1);
		z-index: 30;
	}

	.hero-circle {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid var(--hero-color);
		overflow: hidden;
		background: white;
		box-shadow: 
			0 4px 8px rgba(0, 0, 0, 0.2),
			0 0 0 1px var(--hero-color);
		transition: all 0.2s ease;
		position: relative;
	}

	.hero-container.current-user .hero-circle {
		animation: currentUserGlow 2s ease-in-out infinite alternate;
	}

	@keyframes currentUserGlow {
		0% {
			box-shadow: 
				0 4px 8px rgba(0, 0, 0, 0.2),
				0 0 0 1px var(--hero-color),
				0 0 8px var(--hero-color);
		}
		100% {
			box-shadow: 
				0 4px 8px rgba(0, 0, 0, 0.2),
				0 0 0 1px var(--hero-color),
				0 0 16px var(--hero-color);
		}
	}

	.hero-container.moving .hero-circle {
		animation: bounce 0.6s ease-in-out infinite;
		
	}

	@keyframes bounce {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
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
		background: var(--hero-color);
		color: white;
		font-weight: 600;
		font-size: 18px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.status-indicators {
		position: absolute;
		top: -4px;
		right: -4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.current-indicator {
		background: #3b82f6;
		animation: pulse 2s ease-in-out infinite;
	}

	.online-indicator {
		background: #10b981;
	}

	.offline-indicator {
		background: #6b7280;
	}

	.moving-indicator {
		background: #f59e0b;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1px;
	}

	.moving-dots {
		display: flex;
		gap: 1px;
	}

	.moving-dots span {
		width: 2px;
		height: 2px;
		background: white;
		border-radius: 50%;
		animation: movingDots 1s ease-in-out infinite;
	}

	.moving-dots span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.moving-dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes movingDots {
		0%, 80%, 100% {
			opacity: 0.3;
		}
		40% {
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.username-label {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-top: 6px;
		pointer-events: none;
	}

	.username-text {
		font-size: 11px;
		font-weight: 500;
		color: #374151;
		background: rgba(255, 255, 255, 0.95);
		padding: 3px 6px;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		text-align: center;
		white-space: nowrap;
		border: 1px solid rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(4px);
	}

	.you-text {
		color: #3b82f6;
		font-weight: 600;
	}

	.location-indicator {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 6px;
		font-size: 10px;
		background: rgba(59, 130, 246, 0.9);
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		white-space: nowrap;
		backdrop-filter: blur(4px);
	}

	.hero-tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		z-index: 40;
		pointer-events: none;
	}

	.tooltip-content {
		background: #1f2937;
		color: white;
		padding: 10px 12px;
		border-radius: 6px;
		font-size: 12px;
		white-space: nowrap;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.tooltip-name {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 4px;
	}

	.tooltip-realname {
		font-size: 11px;
		opacity: 0.8;
		margin-bottom: 4px;
	}

	.tooltip-status {
		font-size: 11px;
		margin-bottom: 2px;
		color: #60a5fa;
	}

	.tooltip-location {
		font-size: 11px;
		margin-bottom: 4px;
		color: #34d399;
	}

	.tooltip-lastseen {
		font-size: 10px;
		opacity: 0.7;
	}

	.tooltip-arrow {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 5px solid #1f2937;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.hero-circle {
			width: 40px;
			height: 40px;
		}

		.hero-initials {
			font-size: 16px;
		}

		.username-text {
			font-size: 10px;
		}

		.tooltip-content {
			font-size: 11px;
			padding: 8px 10px;
		}
	}
</style>