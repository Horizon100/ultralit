<script lang="ts">
	import { onMount } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import Pixelmap from '$lib/assets/game/maps/pixelmap.svg';

	interface PlayerPosition {
		x: number;
		y: number;
	}

	interface NPC {
		id: number;
		x: number;
		y: number;
		type: string;
	}

	let player = tweened<PlayerPosition>({ x: 50, y: 50 }, { duration: 100, easing: cubicOut });
	let npcs: NPC[] = [
		{ id: 1, x: 100, y: 100, type: 'friendly' },
		{ id: 2, x: 200, y: 200, type: 'enemy' }
	];
	let isLoading = true;
	let playerDirection = 'down';
	let isMoving = false;
	let animationFrame = 0;
	let zoomFactor = 1;
	let gameContainer: HTMLElement;

	const pixelSize = 40;
	const moveSpeed = pixelSize;
	const mapWidth = 256;
	const mapHeight = 256;
	const minZoom = 0.5;
	const maxZoom = 4;
	const zoomStep = 0.1;

	function handleMovement(event: KeyboardEvent) {
		if (isMoving) return;

		let newX = $player.x;
		let newY = $player.y;

		switch (event.key) {
			case 'ArrowUp':
				newY -= moveSpeed;
				playerDirection = 'up';
				break;
			case 'ArrowDown':
				newY += moveSpeed;
				playerDirection = 'down';
				break;
			case 'ArrowLeft':
				newX -= moveSpeed;
				playerDirection = 'left';
				break;
			case 'ArrowRight':
				newX += moveSpeed;
				playerDirection = 'right';
				break;
			default:
				return;
		}

		if (newX >= 0 && newX < mapWidth * pixelSize && newY >= 0 && newY < mapHeight * pixelSize) {
			isMoving = true;
			player.set({ x: newX, y: newY }).then(() => {
				isMoving = false;
			});
		}
	}

	function interactWithNPC(npc: NPC) {
		alert(`Interacting with ${npc.type} NPC ${npc.id}`);
	}

	function animatePlayer() {
		if (isMoving) {
			animationFrame = (animationFrame + 1) % 4;
		} else {
			animationFrame = 0;
		}
		requestAnimationFrame(animatePlayer);
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
		const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomFactor + delta));

		if (newZoom !== zoomFactor) {
			const rect = gameContainer.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;

			zoomFactor = newZoom;
			updateGameContainerTransform(x, y);
		}
	}

	function updateGameContainerTransform(x: number, y: number) {
		if (gameContainer) {
			const scale = zoomFactor;
			const translateX = x - x * scale;
			const translateY = y - y * scale;
			gameContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === '+' || event.key === '=') {
			zoomFactor = Math.min(maxZoom, zoomFactor + zoomStep);
			updateGameContainerTransform(gameContainer.clientWidth / 2, gameContainer.clientHeight / 2);
		} else if (event.key === '-') {
			zoomFactor = Math.max(minZoom, zoomFactor - zoomStep);
			updateGameContainerTransform(gameContainer.clientWidth / 2, gameContainer.clientHeight / 2);
		}
	}

	onMount(() => {
		isLoading = false;
		animatePlayer();
	});
</script>

<svelte:window on:keydown={handleMovement} on:keydown={handleKeyDown} />

{#if isLoading}
	<div class="loading-screen">Loading...</div>
{:else}
	<div
		bind:this={gameContainer}
		class="game-container"
		on:wheel={handleWheel}
		role="application"
		aria-label="Game map"
		tabindex="0"
	>
		<img src={Pixelmap} alt="Pixel Map" class="pixelmap" />
		<div
			class="player {playerDirection} frame-{animationFrame}"
			style="left: {$player.x}px; top: {$player.y}px;"
		></div>
		{#each npcs as npc (npc.id)}
			<div
				class="npc {npc.type}"
				style="left: {npc.x}px; top: {npc.y}px;"
				on:click={() => interactWithNPC(npc)}
				on:keydown={(e) => e.key === 'Enter' && interactWithNPC(npc)}
				role="button"
				tabindex="0"
				aria-label="{npc.type} NPC"
			></div>
		{/each}
	</div>
{/if}

<style>
	.game-container {
		width: 60%;
		height: 89%;
		top: 11%;
		left: 20%;
		position: absolute;
		border-radius: 50px;
		z-index: 1000;
		overflow: hidden;
		transition: transform 0.1s ease;
		transform-origin: 0 0;
	}
	.pixelmap {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}
	.player,
	.npc {
		position: absolute;
		width: 16px;
		height: 16px;
		background-size: 64px 64px;
		image-rendering: pixelated;
	}
	.player {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg id='down'%3E%3Crect x='6' y='6' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='10' width='8' height='2' fill='%23ff0000'/%3E%3Crect x='4' y='12' width='2' height='4' fill='%230000ff'/%3E%3Crect x='10' y='12' width='2' height='4' fill='%230000ff'/%3E%3C/g%3E%3Cg id='left' transform='translate(16 0)'%3E%3Crect x='10' y='6' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='10' width='8' height='2' fill='%23ff0000'/%3E%3Crect x='2' y='12' width='4' height='2' fill='%230000ff'/%3E%3Crect x='8' y='12' width='4' height='2' fill='%230000ff'/%3E%3C/g%3E%3Cg id='right' transform='translate(32 0)'%3E%3Crect x='2' y='6' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='10' width='8' height='2' fill='%23ff0000'/%3E%3Crect x='4' y='12' width='4' height='2' fill='%230000ff'/%3E%3Crect x='10' y='12' width='4' height='2' fill='%230000ff'/%3E%3C/g%3E%3Cg id='up' transform='translate(48 0)'%3E%3Crect x='6' y='10' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='4' width='8' height='2' fill='%23ff0000'/%3E%3Crect x='4' y='6' width='2' height='4' fill='%230000ff'/%3E%3Crect x='10' y='6' width='2' height='4' fill='%230000ff'/%3E%3C/g%3E%3C/svg%3E");
	}
	.player.down {
		background-position: 0 0;
	}
	.player.left {
		background-position: -16px 0;
	}
	.player.right {
		background-position: -32px 0;
	}
	.player.up {
		background-position: -48px 0;
	}
	.npc.friendly {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect x='6' y='2' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='8' width='8' height='6' fill='%2300ff00'/%3E%3C/svg%3E");
	}
	.npc.enemy {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Crect x='6' y='2' width='4' height='4' fill='%23ffd700'/%3E%3Crect x='4' y='8' width='8' height='6' fill='%23ff0000'/%3E%3C/svg%3E");
	}
	.loading-screen {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.5);
		color: white;
		font-size: 24px;
	}
</style>
