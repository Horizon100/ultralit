<script>
	import { page } from '$app/stores';
	import { writable } from 'svelte/store';
	import github from '$lib/images/github.svg';
	import avatar from '$lib/images/avatar.svg';
	import { LightSwitch } from '@skeletonlabs/skeleton';
	import Login from "../lib/Login.svelte";


	export let toggleOverlay;
	export let overlayOpen;
	
	const avatarOverlayOpen = writable(false);
	let overlayPosition = writable(-600); // Start fully closed
	let isDragging = false;
	let startY = 0;
	let startPosition = 0;

	function toggleAvatarOverlay() {
		avatarOverlayOpen.update(n => !n);
		$overlayPosition = $avatarOverlayOpen ? 50 : -600;
	}

	function handleDragStart(event) {
		isDragging = true;
		startY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
		startPosition = $overlayPosition;
		event.preventDefault();
	}

	function handleDragMove(event) {
		if (!isDragging) return;
		const currentY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
		const diff = currentY - startY;
		let newPosition = startPosition + diff;

		// Constrain the overlay position
		newPosition = Math.min(Math.max(newPosition, -600), 50);
		$overlayPosition = newPosition;
	}

	function handleDragEnd() {
		isDragging = false;
		if ($overlayPosition > -275) { // If dragged more than halfway, open it
			$avatarOverlayOpen = true;
			$overlayPosition = 50;
		} else {
			$avatarOverlayOpen = false;
			$overlayPosition = -600;
		}
	}
</script>

<svelte:window 
	on:mousemove={handleDragMove}
	on:touchmove={handleDragMove}
	on:mouseup={handleDragEnd}
	on:touchend={handleDragEnd}
/>

<header>
	<div class="corner-l">

	</div>

	<div class="corner-r">
		<Login />


	</div>

	<div class="corner-c">
		<button 
			on:click={toggleAvatarOverlay}
			on:mousedown={handleDragStart}
			on:touchstart={handleDragStart}
			class="avatar-btn"
		>
			<!-- <img src={avatar} alt="Avatar" class="avatar" /> -->
		</button>


	</div>
</header>

<div 
	class="avatar-overlay" 
	class:open={$avatarOverlayOpen}
	style="transform: translateY({$overlayPosition}px)"
	on:mousedown={handleDragStart}
	on:touchstart={handleDragStart}
>
	<h2>Avatar Overlay</h2>
	<p>This is the content of the avatar overlay.</p>
	<div class="drag-handle"></div>

</div>

<style>
	header {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 50px;
		background-color: none;
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
	}

	.corner-l {
		display: flex;
		align-items: center;
		margin-left: 1.5rem;
		
	}

	.corner-r {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.corner-c {
		display: flex;
		align-items: center;
		justify-content: center;
		max-width: 300px;
		justify-content: center;
		align-items: center;

	}


	.avatar-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;

	}

	.avatar-btn:hover {


	}

	.avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		transition: transform 1.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		transform: rotate(0deg);
		position: absolute;
		left: 34%;
		top: 5px;

		
	}


	.avatar:hover {

		transform: rotate(1080deg);

	}

	.avatar-overlay {
		position: fixed;
		top: 0;
		left: 5%;
		width: 90%;
		height: 47%;
		border-bottom-left-radius: 100px;
		border-bottom-right-radius: 100px;
        background: linear-gradient(to bottom, #292929, #333333);
		overflow: hidden;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding-top: 20px;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		transform: translateY(-600px); /* Start off-screen */
		
	}

	.avatar-overlay.open {
		transform: translateY(50px);
	}

	.drag-handle {
		width: 300px;
		height: 10px;
		bottom: 0;
		display: flex;
		position: absolute;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		background-color: #1c1c1c;
		margin-top: 45%;
		cursor: grab;
		
		
	}
</style>