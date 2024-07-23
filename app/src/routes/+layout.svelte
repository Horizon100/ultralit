<script lang="ts">
	import { AppShell } from '@skeletonlabs/skeleton';
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';

	import { slide } from 'svelte/transition';
	import { writable } from 'svelte/store';
	import github from '$lib/images/github.svg';

	import '../app.css';

	const leftOverlayOpen = writable(false);
	let leftOverlayPosition = writable(-250);
	const rightOverlayOpen = writable(false);
	let rightOverlayPosition = writable(250);
	let isDragging = false;
	let startX = 0;
	let startPosition = 0;
	let activeOverlay: 'left' | 'right' | null = null;

	function toggleLeftOverlay() {
		leftOverlayOpen.update(n => !n);
		$leftOverlayPosition = $leftOverlayOpen ? 0 : -250;
	}

	function toggleRightOverlay() {
		rightOverlayOpen.update(n => !n);
		$rightOverlayPosition = $rightOverlayOpen ? 0 : 250;
	}

	function handleDragStart(event: MouseEvent | TouchEvent, side: 'left' | 'right') {
		isDragging = true;
		activeOverlay = side;
		startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
		startPosition = side === 'left' ? $leftOverlayPosition : $rightOverlayPosition;
		event.preventDefault();
	}

	function handleDragMove(event: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		const currentX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
		const diff = currentX - startX;
		let newPosition = startPosition + (activeOverlay === 'left' ? diff : -diff);

		// Constrain the overlay position
		if (activeOverlay === 'left') {
			newPosition = Math.min(Math.max(newPosition, -250), 0);
			$leftOverlayPosition = newPosition;
		} else {
			newPosition = Math.min(Math.max(newPosition, -250), 0);
			$rightOverlayPosition = -newPosition;
		}
	}

	function handleDragEnd() {
		isDragging = false;
		if (activeOverlay === 'left') {
			if ($leftOverlayPosition > -125) {
				$leftOverlayOpen = true;
				$leftOverlayPosition = 0;
			} else {
				$leftOverlayOpen = false;
				$leftOverlayPosition = -250;
			}
		} else {
			if ($rightOverlayPosition < 125) {
				$rightOverlayOpen = true;
				$rightOverlayPosition = 0;
			} else {
				$rightOverlayOpen = false;
				$rightOverlayPosition = 250;
			}
		}
		activeOverlay = null;
	}
</script>

<svelte:window 
	on:mousemove={handleDragMove}
	on:touchmove={handleDragMove}
	on:mouseup={handleDragEnd}
	on:touchend={handleDragEnd}
/>

<AppShell>
	<svelte:fragment slot="header">
		<Header 
			toggleLeftOverlay={toggleLeftOverlay} 
			toggleRightOverlay={toggleRightOverlay}
			{leftOverlayOpen}
			{rightOverlayOpen}
		/>
	</svelte:fragment>
	
	<!-- Left Overlay -->
	<div 
		class="overlay left-overlay bg-surface-200 dark:bg-surface-800 shadow-lg"
		class:open={$leftOverlayOpen}
		style="transform: translateX({$leftOverlayPosition}px)"
		on:mousedown={(e) => handleDragStart(e, 'left')}
		on:touchstart={(e) => handleDragStart(e, 'left')}
	>
		<div class="drag-handle"></div>
		<nav class="list-nav p-4">
			<ul>
				<h3>Goals</h3>
				<li><a href="/" class="overlay-link">#erp</a></li>

				<hr class="solid">

				<li><a href="/calendar" class="overlay-link">Calendar</a></li>
				<li><a href="/about" class="overlay-link">Tasks</a></li>

				<hr class="solid">
				<li><a href="/home" class="overlay-link">Marketplace</a></li>
				<li><a href="/about" class="overlay-link">Discover</a></li>

				<hr class="solid">

				<li><a href="/home" class="overlay-link">Marketplace</a></li>
				<li><a href="/about" class="overlay-link">Discover</a></li>

				<hr class="solid">


				<a href="https://github.com/Horizon100/ultralit" class="github-link">
					<img src={github} alt="GitHub" />
				</a>
			</ul>
			<h4>© 2024 Horizon, Inc.

			</h4>
			<a href="/about" class="overlay-link">About</a>
			<a href="/about" class="overlay-link">Blog</a>
			<a href="/about" class="overlay-link">Terms & Privacy</a>
			<a href="/about" class="overlay-link">FAQ</a>



		</nav>
	</div>

	<!-- Right Overlay -->
	<div 
		class="overlay right-overlay bg-surface-200 dark:bg-surface-800 shadow-lg"
		class:open={$rightOverlayOpen}
		style="transform: translateX({$rightOverlayPosition}px)"
		on:mousedown={(e) => handleDragStart(e, 'right')}
		on:touchstart={(e) => handleDragStart(e, 'right')}
	> 

		<div class="drag-handle"></div>
		<nav class="list-nav p-4">
			<ul>
				<li><a href="/" class="overlay-link">Chat</a></li>
			</ul>
		</nav>
	</div>
	
	<main class="p-4">
		<slot />
	</main>

	<svelte:fragment slot="footer">
		<Footer />
	</svelte:fragment>
</AppShell>

<style>
	.overlay {
		position: fixed;
		top: 5%;
		height: 90%;		
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		overflow-y: auto;
		z-index: 1004;
		border: solid 2px #30363e;
	}

	.left-overlay {
		left: 0;
		border-top-right-radius: 50px;
		border-bottom-right-radius: 50px;
		width: 280px;
		background: linear-gradient(to right, #292929, #333333);

		overflow-x: hidden;

	}

	.right-overlay {
		right: 0;
		width: 280px;
		border-top-left-radius: 50px;
		border-bottom-left-radius: 50px;
		background: linear-gradient(to left, #292929, #333333);

		overflow-x: hidden;
	}

	.left-overlay .drag-handle {
		right: -20px;
		border-top-right-radius: 20px;
		border-bottom-right-radius: 20px;
	}

	.right-overlay .drag-handle {
		left: -20px;
		border-top-left-radius: 20px;
		border-bottom-left-radius: 20px;
	}

	.drag-handle {
		position: absolute;
		top: 50%;
		width: 40px;
		height: 300px;
		border-radius: 20px;
		background-color: #30363d;
		cursor: grab;
	}

	.list-nav ul {
		list-style-type: none;
		padding: 1rem;

	}

	.list-nav li {
		margin-bottom: 0.75rem;
	}

	.overlay-link {
		display: block;
		padding: 0.5rem 1rem;
		color: var(--color-text-base);
		text-decoration: none;
		transition: all 0.2s ease-in-out;
		border-radius: 0.25rem;
	}

	.overlay-link:hover {
		background-color: var(--color-primary-500);
		color: white;
	}

	.github-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2em;
		height: 2em;
		margin-right: 2rem;
	}

	.github-link img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>