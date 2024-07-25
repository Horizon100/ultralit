<script>
	import { page } from '$app/stores';
	import { writable } from 'svelte/store';
	import github from '$lib/images/github.svg';
	import { LightSwitch } from '@skeletonlabs/skeleton';
    import Assistant from './Assistant.svelte';

	export let toggleOverlay;
	export let overlayOpen;
	
	const avatarOverlayOpen = writable(false);
	let overlayPosition = writable(550); // Start with 50px visible (600 - 50)
	let isDragging = false;
	let startX = 0; // Start X position for horizontal dragging
	let startY = 0; // Start Y position for vertical dragging
	let startPosition = 0;

	// New store to track active inner overlay
	const activeOverlay = writable('main');

	const overlayContents = {
		main: { title: "Assistant", content: "", component: Assistant },
		profile: { title: "Profile", content: "View and edit your profile information here." },
		settings: { title: "Settings", content: "Adjust your app settings and preferences." },
		help: { title: "Help", content: "Get assistance and view FAQs." }
	};

	const overlayOrder = ['main', 'profile', 'settings', 'help'];

	function toggleAvatarOverlay() {
		avatarOverlayOpen.update(n => !n);
		$overlayPosition = $avatarOverlayOpen ? 0 : 550;
	}

	function handleDragStart(event) {
		isDragging = true;
		startY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
		startX = event.type.includes('mouse') ? event.clientX : event.touches[0].clientX;
		startPosition = $overlayPosition;
		event.preventDefault();
	}

	function handleDragMove(event) {
		if (!isDragging) return;
		const currentY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
		const currentX = event.type.includes('mouse') ? event.clientX : event.touches[0].clientX;
		const diffY = startY - currentY;
		const diffX = startX - currentX;
		let newPosition = startPosition - diffY;

		newPosition = Math.max(Math.min(newPosition, 550), 0);
		$overlayPosition = newPosition;

		// Handle horizontal drag to change active overlay
		if (Math.abs(diffX) > 50) {
			if (diffX > 0) {
				// Dragging to the left
				changeOverlay('next');
			} else {
				// Dragging to the right
				changeOverlay('prev');
			}
			isDragging = false; // Stop dragging to prevent multiple changes
		}
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

    function changeOverlay(direction) {
	const currentIndex = overlayOrder.indexOf($activeOverlay);
	let nextIndex = direction === 'next' 
		? (currentIndex + 1) % overlayOrder.length 
		: (currentIndex - 1 + overlayOrder.length) % overlayOrder.length;
	
	const nextOverlay = overlayOrder[nextIndex];
	const currentElement = document.querySelector('.overlay-content');
	const nextElement = document.querySelector('.overlay-content-next');

	if (currentElement) {
		currentElement.classList.add('overlay-content-leave');
	}

	if (nextElement) {
		nextElement.classList.add('overlay-content-enter');
		setTimeout(() => {
			activeOverlay.set(nextOverlay);
			setTimeout(() => {
				if (nextElement) {
					nextElement.classList.remove('overlay-content-enter');
				}
			}, 300);
			if (currentElement) {
				currentElement.classList.remove('overlay-content-leave');
			}
		}, 300);
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
        <button class:active={$activeOverlay === 'main'} class="round-button" on:click={() => setActiveOverlay('main')}>🎙️</button>
        <button class:active={$activeOverlay === 'profile'} class="round-button" on:click={() => setActiveOverlay('profile')}>🗂️</button>
        <button class:active={$activeOverlay === 'settings'} class="round-button" on:click={() => setActiveOverlay('settings')}>🔑</button>
        <button class:active={$activeOverlay === 'help'} class="round-button" on:click={() => setActiveOverlay('help')}>🎯</button>
    </div>
	<h2>{overlayContents[$activeOverlay].title}</h2>
	{#if overlayContents[$activeOverlay].component}
		<svelte:component this={overlayContents[$activeOverlay].component} />
	{:else}
		<p>{overlayContents[$activeOverlay].content}</p>
	{/if}
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

    .overlay-content {
	transition: transform 0.3s ease-in-out;
    }

    .overlay-content-enter {
        transform: translateX(100%);
    }

    .overlay-content-leave {
        transform: translateX(-100%);
    }
	.overlay-toggle {
		width: 100px;
		height: 50px;
		background-color: #30363d;
		border-radius: 10px;
		cursor: grab;
	}

	.avatar-overlay {
		position: fixed;
		bottom: 0px;
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
		height: 15px;
		position: absolute;
		top: 0;
		background-color: #1c1c1c;
		border-bottom-left-radius: 20px;
		border-bottom-right-radius: 20px;
		margin-bottom: 20px;
		cursor: grab;
	}

	.button-row {
		display: flex;
		justify-content: center;
		gap: 20px;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

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