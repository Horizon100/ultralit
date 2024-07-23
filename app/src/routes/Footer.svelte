<script>
	import { page } from '$app/stores';
	import { writable } from 'svelte/store';
	import github from '$lib/images/github.svg';
	import { LightSwitch } from '@skeletonlabs/skeleton';
	
	export let toggleOverlay;
	export let overlayOpen;
	
	const avatarOverlayOpen = writable(false);
	let overlayPosition = writable(550); // Start with 50px visible (600 - 50)
	let isDragging = false;
	let startY = 0;
	let startPosition = 0;

	// New store to track active inner overlay
	const activeOverlay = writable('main');

	const overlayContents = {
		main: { title: "Main Overlay", content: "This is the main content of the overlay." },
		profile: { title: "Profile", content: "View and edit your profile information here." },
		settings: { title: "Settings", content: "Adjust your app settings and preferences." },
		help: { title: "Help", content: "Get assistance and view FAQs." }
	};

	function toggleAvatarOverlay() {
		avatarOverlayOpen.update(n => !n);
		$overlayPosition = $avatarOverlayOpen ? 0 : 550;
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
		const diff = startY - currentY;
		let newPosition = startPosition - diff;

		newPosition = Math.max(Math.min(newPosition, 550), 0);
		$overlayPosition = newPosition;
	}

	function handleDragEnd() {
		isDragging = false;
		if ($overlayPosition < 275) {
			$avatarOverlayOpen = true;
			$overlayPosition = 0;
		} else {
			$avatarOverlayOpen = false;
			$overlayPosition = 550;
		}
	}

	function setActiveOverlay(overlay) {
		activeOverlay.set(overlay);
	}
</script>

<svelte:window 
	on:mousemove={handleDragMove}
	on:touchmove={handleDragMove}
	on:mouseup={handleDragEnd}
	on:touchend={handleDragEnd}
/>

<footer>
	<div class="corner-l">
		<!-- Left corner content -->
	</div>


    <div class="corner-r">
		<!-- Right corner content -->
	</div>
</footer>

<div 
	class="avatar-overlay" 
	class:open={$avatarOverlayOpen}
	style="transform: translateY({$overlayPosition}px)"
    
	on:mousedown={handleDragStart}
	on:touchstart={handleDragStart}
>
	<div class="drag-handle"></div>
	<div class="button-row">
		<button class="round-button" on:click={() => setActiveOverlay('main')}>M</button>
		<button class="round-button" on:click={() => setActiveOverlay('profile')}>P</button>
		<button class="round-button" on:click={() => setActiveOverlay('settings')}>S</button>
		<button class="round-button" on:click={() => setActiveOverlay('help')}>H</button>
	</div>
	<h2>{overlayContents[$activeOverlay].title}</h2>
	<p>{overlayContents[$activeOverlay].content}</p>
</div>

<style>
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		height: 50px;
		background-color: none;
		position: fixed;
		bottom: 0;
		left: 0;
		z-index: 1001;
	}

	.corner-l, .corner-r {
		display: flex;
		align-items: center;
		width: 25%;
	}

    .corner-c {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-grow: 1;
	}

	.overlay-toggle {
		width: 100px;
		height: 5px;
		background-color: #30363d;
		border-radius: 10px;
		cursor: grab;
	}

	.avatar-overlay {
		position: fixed;
		bottom: 40px;
		left: 5%;
		width: 90%;
		height: 43%;
        border-top-left-radius: 100px;
		border-top-right-radius: 100px;
        background: linear-gradient(to top, #292929, #333333);
		overflow: hidden;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding-top: 20px;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.drag-handle {
		width: 300px;
		height: 10px;
        border-radius: 20px;
		background-color: #30363d;
		margin-bottom: 20px;
		cursor: grab;
	}

	.button-row {
		display: flex;
		justify-content: center;
		gap: 20px;
		margin-bottom: 20px;
	}

	.round-button {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: #30363d;
		color: white;
		border: none;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.3s;
	}

	.round-button:hover {
		background-color: #444c56;
	}
</style>