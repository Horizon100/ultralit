<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import {fly, fade} from 'svelte/transition'
	import { currentUser } from '$lib/pocketbase';
	import CursorEffect from '$lib/components/canvas/CursorEffect.svelte';
	import ConfigWrapper from '$lib/components/agents/ConfigWrapper.svelte';
	import FileContainer from '$lib/components/canvas/FileContainer.svelte';
	import ImportDocs from '$lib/components/features/importDocs.svelte';
	import * as fileHandlers from '$lib/utils/fileHandlers';
	import LeftSideMenu from '$lib/components/ui/LeftSideMenu.svelte';
	import RightSideMenu from '$lib/components/ui/RightSideMenu.svelte';
	import { writable } from 'svelte/store';
	import Assets from '$lib/components/canvas/Assets.svelte';
	import type { Shape, AIAgent } from '$lib/types/types'; // Import Shape from your types file
	import { createAgent, getAgentById, updateAgent, deleteAgent } from '$lib/clients/agentClient';
	import { agentStore } from '$lib/stores/agentStore';
	import Connector from '$lib/components/canvas/Connector.svelte';
	import { BrainCog, ChevronRight, Maximize, X } from 'lucide-svelte';

	let svgElement: SVGSVGElement;
	let viewBox = '0 0 2000 857';
	let containerDiv: HTMLDivElement;
	let shapes: Shape[] = []; // Update this to use the Shape type
	let connectors: Array<{
		id: string;
		startId: string;
		endId: string;
		startPoint: string;
		endPoint: string;
	}> = [];
	let isConnecting = false;
	let connectingStart: { shapeId: string; point: string } | null = null;
	let agents: AIAgent[] = [];
	let selectedShape: Shape | null = null;

	let selectedShapeId: string | null = null;
	/*
	 * export let startPoint: string;
	 * export let endPoint: string;
	 */

	export let shape: Shape;
	export let scale: number;

	// export let userId: string;

	$: canvasWidth = width - $leftSideMenuWidth - $rightSideMenuWidth;
	$: canvasOffsetX = $leftSideMenuWidth;

	const dispatch = createEventDispatcher();

	let showConnectionPoints = false;

	function startConnection(point: 'top' | 'right' | 'bottom' | 'left', shapeId: string) {
		isConnecting = true;
		connectingStart = { shapeId, point };
	}

	// Import
	let fileInput: HTMLInputElement;
	let showImportDocs = false;
	let importX = 0;
	let importY = 0;
	let uploadedFiles: Array<{ file: File; x: number; y: number }> = [];

	// Zoom
	let zoomLevel = tweened(100, {
		duration: 300,
		easing: cubicOut
	});
	let offsetX = tweened(0, {
		duration: 300,
		easing: cubicOut
	});
	let offsetY = tweened(0, {
		duration: 300,
		easing: cubicOut
	});

	let width: number;
	let height: number;
	let gridPath: string;

	$: scale = $zoomLevel / 100;
	$: viewBox = `${$offsetX} ${$offsetY} ${width / scale} ${height / scale}`;

	// Side menus
	let showLeftSideMenu = false;
	let showRightSideMenu = false;

	const leftSideMenuWidth = tweened(0, {
		duration: 300,
		easing: cubicOut
	});

	const rightSideMenuWidth = tweened(0, {
		duration: 300,
		easing: cubicOut
	});

	const leftMenuOpenedByToggle = writable(false);
	const rightMenuOpenedByToggle = writable(false);

	function toggleLeftSideMenu() {
		showLeftSideMenu = !showLeftSideMenu;
		leftSideMenuWidth.set(showLeftSideMenu ? 400 : 0);
		leftMenuOpenedByToggle.set(showLeftSideMenu);
	}

	function toggleRightSideMenu() {
		showRightSideMenu = !showRightSideMenu;
		rightSideMenuWidth.set(showRightSideMenu ? 400 : 0);
		rightMenuOpenedByToggle.set(showRightSideMenu);
	}

	function handleLeftSideMenuLeave() {
		if (showLeftSideMenu && !$leftMenuOpenedByToggle) {
			showLeftSideMenu = false;
			leftSideMenuWidth.set(0);
		}
	}

	function openLeftSideMenu(shape: Shape) {
		showLeftSideMenu = true;
		leftSideMenuWidth.set(400);
		leftMenuOpenedByToggle.set(true);
		selectedShape = shape;
	}


	function handleRightSideMenuLeave() {
		if (showRightSideMenu && !$rightMenuOpenedByToggle) {
			showRightSideMenu = false;
			rightSideMenuWidth.set(0);
		}
	}

	function handleLeftEdgeHover() {
		if (!showLeftSideMenu) {
			showLeftSideMenu = true;
			leftSideMenuWidth.set(400);
		}
	}

	function handleRightEdgeHover() {
		if (!showRightSideMenu) {
			showRightSideMenu = true;
			rightSideMenuWidth.set(400);
		}
	}

	// Zoom functions
	function zoomIn() {
		if ($zoomLevel < 1000) {
			zoomLevel.set($zoomLevel + 10);
		}
	}

	function zoomOut() {
		if ($zoomLevel > 100) {
			zoomLevel.set(Math.max(100, $zoomLevel - 10));
		}
	}

	function resetZoom() {
		zoomLevel.set(100);
		offsetX.set(0);
		offsetY.set(0);
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const rect = svgElement.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const zoomFactor = 1 - event.deltaY * 0.01;
		const newZoomLevel = Math.min(1000, Math.max(100, $zoomLevel * zoomFactor));

		const mouseXInSVG = $offsetX + mouseX / scale;
		const mouseYInSVG = $offsetY + mouseY / scale;

		const newScale = newZoomLevel / 100;
		const newOffsetX = mouseXInSVG - mouseX / newScale;
		const newOffsetY = mouseYInSVG - mouseY / newScale;

		zoomLevel.set(newZoomLevel);
		offsetX.set(newOffsetX);
		offsetY.set(newOffsetY);
	}

	// Pan functions
	let isPanning = false;
	let startX: number;
	let startY: number;

	function startPan(event: MouseEvent) {
		isPanning = true;
		startX = event.clientX;
		startY = event.clientY;
		svgElement.style.cursor = 'grab';
	}

	function pan(event: MouseEvent) {
		if (!isPanning) return;

		const panMultiplier = 4;
		const dx = (event.clientX - startX) * panMultiplier;
		const dy = (event.clientY - startY) * panMultiplier;

		let newOffsetX = $offsetX - dx / scale;
		let newOffsetY = $offsetY - dy / scale;

		const maxOffsetX = width * (1 - 1 / scale);
		const maxOffsetY = height * (1 - 1 / scale);

		newOffsetX = Math.max(Math.min(newOffsetX, maxOffsetX), 0);
		newOffsetY = Math.max(Math.min(newOffsetY, maxOffsetY), 0);

		offsetX.set(newOffsetX);
		offsetY.set(newOffsetY);

		startX = event.clientX;
		startY = event.clientY;
	}

	function endPan() {
		isPanning = false;
		svgElement.style.cursor = 'default';
	}

	// Grid
	function updateGrid() {
		const gridSize = 25;
		const lines = [];

		for (let x = 0; x <= width; x += gridSize) {
			lines.push(`M ${x} 0 V ${height}`);
		}
		for (let y = 0; y <= height; y += gridSize) {
			lines.push(`M 0 ${y} H ${width}`);
		}

		gridPath = lines.join(' ');
	}

	function updateDimensions() {
		if (typeof window !== 'undefined') {
			width = window.innerWidth;
			height = window.innerHeight;
			updateGrid();
		}
	}

	function updateShapePositions() {
		shapes = shapes.map((shape) => ({
			...shape,
			x: shape?.x ? shape.x + canvasOffsetX / scale : 0,
			y: shape.y
		}));
	}


	// Shape handling
	async function handleAddShape(event: CustomEvent<{ shape: Shape; x: number; y: number }>) {
		const { shape, x, y } = event.detail;
		const newShape: Shape & { opacity: any } = {
			...shape,
			id: `${shape.id}-${Date.now()}`,
			x,
			y,
			opacity: tweened(0, {
				duration: 300,
				easing: cubicOut
			})
		};
		shapes = [...shapes, newShape];
		newShape.opacity.set(1);

		if (shape.id === 'Agent') {
			try {
				const agentData: Partial<AIAgent> = {
					name: `Agent ${Date.now()}`,
					prompt: '',
					description: '',
					avatar: '',
					role: [],
					capabilities: [],
					focus: 'processor',
					status: 'active',
					tags: [],
					performance: 0,
					version: '1.0',
					position: { x, y },
					expanded: false
				};

				const createdAgent = await createAgent(agentData);
				agentStore.addAgent(createdAgent);

				console.log('Agent created and added to store:', createdAgent);
			} catch (error) {
				console.error('Error creating agent:', error);
			}
		}
	}

	function handleCanvasClick(event: MouseEvent) {
		const clickedElement = event.target as Element;
		if (!clickedElement.closest('.shape-container')) {
			selectedShape = null;
			showLeftSideMenu = false;
			leftSideMenuWidth.set(0);
		}
	}

	function handleShapeClick(shape: Shape) {
		selectedShape = shape;
		showLeftSideMenu = true;
		leftSideMenuWidth.set(400);
	}

	let tempConnector: { startX: number; startY: number; endX: number; endY: number } | null = null;

	function handleMouseMove(event: MouseEvent) {
		if (isConnecting && connectingStart) {
			const startShape = shapes.find((s) => s.id === connectingStart?.shapeId);
			if (startShape) {
				const startPoint = getConnectionPoint(startShape, connectingStart.point);
				tempConnector = {
					startX: startPoint.x,
					startY: startPoint.y,
					endX: (event.clientX - $offsetX) / scale,
					endY: (event.clientY - $offsetY) / scale
				};
			}
		}
	}

	function handleMouseUp(event: MouseEvent) {
		if (isConnecting && connectingStart) {
			const endShape = shapes.find((shape) => {
				const rect = shape.ref?.getBoundingClientRect();
				return (
					rect &&
					event.clientX > rect.left &&
					event.clientX < rect.right &&
					event.clientY > rect.top &&
					event.clientY < rect.bottom
				);
			});

			if (endShape && endShape.id !== connectingStart.shapeId) {
				const endPoint = getNearestConnectionPoint(endShape, event.clientX, event.clientY);
				connectors = [
					...connectors,
					{
						id: `connector-${Date.now()}`,
						startId: connectingStart.shapeId,
						endId: endShape.id,
						startPoint: connectingStart.point,
						endPoint
					}
				];
			}

			isConnecting = false;
			connectingStart = null;
			tempConnector = null;
		}
	}

	function getConnectionPoint(shape: Shape, point: string) {
		const rect = shape.ref?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };

		switch (point) {
			case 'top':
				return { x: rect.left + rect.width / 2, y: rect.top };
			case 'right':
				return { x: rect.right, y: rect.top + rect.height / 2 };
			case 'bottom':
				return { x: rect.left + rect.width / 2, y: rect.bottom };
			case 'left':
				return { x: rect.left, y: rect.top + rect.height / 2 };
			default:
				return { x: 0, y: 0 };
		}
	}

	function getNearestConnectionPoint(shape: Shape, x: number, y: number) {
		const points = ['top', 'right', 'bottom', 'left'];
		let nearestPoint = 'top';
		let minDistance = Infinity;

		points.forEach((point) => {
			const connectionPoint = getConnectionPoint(shape, point);
			const distance = Math.sqrt(
				Math.pow(x - connectionPoint.x, 2) + Math.pow(y - connectionPoint.y, 2)
			);
			if (distance < minDistance) {
				minDistance = distance;
				nearestPoint = point;
			}
		});

		return nearestPoint;
	}

	// Drag and drop handling
	function handleDrop(event: DragEvent) {
		event.preventDefault();

		if (event.dataTransfer) {
			const shapeData = event.dataTransfer.getData('application/json');

			if (shapeData) {
				try {
					const shape = JSON.parse(shapeData) as Shape;
					if (svgElement) {
						const rect = svgElement.getBoundingClientRect();
						const x = (event.clientX - rect.left - $offsetX) / scale;
						const y = (event.clientY - rect.top - $offsetY) / scale;

						const newShape = addShapeToCanvas(shape, x, y);
						if (shape.id === 'Agent') {
							createAgentInDatabase(x, y);
						}

						// Select the new shape and open left side menu
						selectedShapeId = newShape.id;
						openLeftSideMenu(newShape);
					}
				} catch (error) {
					console.error('Error parsing shape data:', error);
				}
			}
		}
	}


	async function createAgentInDatabase(x: number, y: number) {
		try {
			const agentData: Partial<AIAgent> = {
				name: `Agent ${Date.now()}`,
				prompt: '',
				description: '',
				avatar: '',
				role: [],
				capabilities: [],
				focus: 'processor',
				status: 'active',
				tags: [],
				performance: 0,
				version: '1.0',
				position: { x, y },
				expanded: false
			};

			const createdAgent = await createAgent(agentData);
			agentStore.addAgent(createdAgent);

			console.log('Agent created and added to store:', createdAgent);
		} catch (error) {
			console.error('Error creating agent:', error);
		}
	}

	function addShapeToCanvas(shape: Shape, x: number, y: number) {
		console.log('Adding shape to canvas:', { shape, x, y });

		// Add the shape to the shapes array
		const newShape: Shape & { opacity: any } = {
			...shape,
			id: `${shape.id}-${Date.now()}`,
			x,
			y,
			opacity: tweened(0, {
				duration: 300,
				easing: cubicOut
			})
		};
		shapes = [...shapes, newShape];
		console.log('Shape added to shapes array:', newShape);
		newShape.opacity.set(1);

		// Add the style to the document head
		if (shape.component?.style) {
			const styleElement = document.createElement('style');
			styleElement.textContent = shape.component.style;
			document.head.appendChild(styleElement);
		}
	}

	function dragShape(event: MouseEvent, shapeId: string) {
		event.stopPropagation();
		const shapeElement = event.target as HTMLElement;
		const startX = event.clientX;
		const startY = event.clientY;
		const startLeft = parseFloat(shapeElement.style.left) || 0;
		const startTop = parseFloat(shapeElement.style.top) || 0;

		function mousemove(event: MouseEvent) {
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;
			shapeElement.style.left = `${startLeft + dx}px`;
			shapeElement.style.top = `${startTop + dy}px`;
		}

		function mouseup() {
			window.removeEventListener('mousemove', mousemove);
			window.removeEventListener('mouseup', mouseup);
		}

		window.addEventListener('mousemove', mousemove);
		window.addEventListener('mouseup', mouseup);
	}

	// Import handling

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		if (event.clipboardData) {
			const items = Array.from(event.clipboardData.items);
			const files = items
				.filter((item) => item.kind === 'file')
				.map((item) => item.getAsFile())
				.filter((file): file is File => file !== null);

			if (files.length > 0) {
				const x = 0;
				const y = 0;
				handleNewFiles(files, x, y);
			}
		}
	}

	function handleNewFiles(files: File[], x: number, y: number) {
		const newFiles = files.map((file) => ({ file, x, y }));
		uploadedFiles = [...uploadedFiles, ...newFiles];
	}

	function handleFileInputChange(event: Event) {
		fileHandlers.handleFileInputChange(event, importX, importY);
	}

	function handleFileMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
		fileHandlers.handleFileMove(event);
	}

	function handleImportComplete(event: CustomEvent<{ files: File[]; x: number; y: number }>) {
		const { files, x, y } = event.detail;
		uploadedFiles = [...uploadedFiles, ...files.map((file) => ({ file, x, y }))];
		showImportDocs = false;
	}

	function handleImportCancel() {
		showImportDocs = false;
	}


	onMount(() => {
		updateDimensions();
		window.addEventListener('resize', updateDimensions);

		if (!svgElement) {
			console.error('SVG element is not defined after mounting');
		} else {
			console.log('SVG element is properly defined');
		}
		const unsubscribe = agentStore.subscribe(
			(value: { agents: AIAgent[]; updateStatus: string }) => {
				agents = Array.isArray(value.agents) ? value.agents : [];
			}
		);

		return () => {
			unsubscribe();
		};
	});
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', updateDimensions);
		}
	});
</script>
<ConfigWrapper/>
<div 
	bind:this={containerDiv}
	class="layout-container"
	on:click={handleCanvasClick}
	on:drop={handleDrop}
	on:paste={handlePaste}
	on:dragover|preventDefault
	role="application"
>
	<CursorEffect />

	<div class="left-edge" on:mouseenter={handleLeftEdgeHover} role="button" tabindex="0"></div>
	<div class="right-edge" on:mouseenter={handleRightEdgeHover}></div>

	<!-- <LeftSideMenu
		width={$leftSideMenuWidth}
		on:mouseleave={handleLeftSideMenuLeave}
		{selectedShape}
		on:click={toggleLeftSideMenu}

	/> -->
	<div class="layout-container">
		<div class="svg-wrapper" style="flex: 1; display: flex;">
			<svg
				bind:this={svgElement}
				class="map"
				version="1.2"
				{viewBox}
				xmlns="http://www.w3.org/2000/svg"
				on:wheel={handleWheel}
				on:mousedown={startPan}
				on:mousemove={handleMouseMove}
				on:mouseup={handleMouseUp}
				on:mouseleave={handleMouseUp}
				role="img"
				style="width: 100%; height: 100%;"
			>
				<g class="grid">
					<path d={gridPath} />
				</g>

				{#each connectors as connector (connector.id)}
					<Connector
						startShape={shapes.find((s) => s.id === connector.startId) ?? defaultShape}
						endShape={shapes.find((s) => s.id === connector.endId) ?? defaultShape}
						startPoint={connector.startPoint}
						endPoint={connector.endPoint}
						{scale}
						offsetX={$offsetX}
						offsetY={$offsetY}
					/>
				{/each}

				{#if tempConnector}
					<line
						x1={tempConnector.startX * scale + $offsetX}
						y1={tempConnector.startY * scale + $offsetY}
						x2={tempConnector.endX * scale + $offsetX}
						y2={tempConnector.endY * scale + $offsetY}
						stroke="black"
						stroke-width="2"
					/>
				{/if}
			</svg>

			{#each shapes as shape (shape.id)}
				<div
					bind:this={shape.ref}
					id={shape.id}
					class="shape-container {selectedShapeId === shape.id ? 'selected' : ''}"
					style="
                        position: absolute;
                        left: calc({(shape.x ?? 0) * scale +
						$offsetX}px + {$leftSideMenuWidth}px - {$rightSideMenuWidth}px);
                        top: calc({(shape.y ?? 0) * scale + $offsetY}px);
                        width: {(shape.width || 120) * scale}px;
                        height: {(shape.height || 120) * scale}px;
                        transform-origin: top left;
                        "
					on:mousedown={(e) => dragShape(e, shape.id)}
					on:click|stopPropagation={() => handleShapeClick(shape)}
					on:mouseenter={() => (showConnectionPoints = true)}
					on:mouseleave={() => (showConnectionPoints = false)}
				>
					<div class="shape-content">
						{@html shape.component?.template || ''}
					</div>
					{#if showConnectionPoints}
						<button
							class="connection-point top"
							on:mousedown={() => startConnection('top', shape.id)}
						></button>
						<button
							class="connection-point right"
							on:mousedown={() => startConnection('right', shape.id)}
						></button>
						<button
							class="connection-point bottom"
							on:mousedown={() => startConnection('bottom', shape.id)}
						></button>
						<button
							class="connection-point left"
							on:mousedown={() => startConnection('left', shape.id)}
						></button>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<RightSideMenu
		width={$rightSideMenuWidth}
		on:mouseleave={handleRightSideMenuLeave}
		{handleAddShape}
		userId={$currentUser?.id}
		on:click={toggleRightSideMenu}
	/>

	<div class="footer">
		<!-- <button on:click={toggleLeftSideMenu}>Toggle Left Menu</button> -->
		<span class="zoom-controls">
			<button on:click={zoomOut}>-</button>
			<span>{$zoomLevel.toFixed(0)}%</span>
			<button on:click={zoomIn}>+</button>
			<button on:click={resetZoom}>
				<Maximize/>
			</button>
		</span>
		<button on:click={toggleRightSideMenu}>
			<span class="open-button">
				{#if showRightSideMenu}
				<BrainCog />

					Agents
					<X />
				{:else}
				  <BrainCog />
				{/if}
			  </span>
		</button>
	</div>

	{#each uploadedFiles as { file, x, y } (file.name)}
		<FileContainer
			{file}
			{x}
			{y}
			transform={{ scale, offsetX: $offsetX, offsetY: $offsetY }}
			on:move={handleFileMove}
		/>
	{/each}

	{#if showImportDocs}
		<ImportDocs
			x={importX}
			y={importY}
			on:complete={handleImportComplete}
			on:cancel={handleImportCancel}
		/>
	{/if}
</div>

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}	
	.layout-container {
		display: flex;
		/* flex-direction: column; */
		height: 100vh; /* Full viewport height */
		width: 100vw;

		/* position: relative; */
		/* background: linear-gradient(to top, #3f4b4b, #333333); */
	}
	.svg-wrapper {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}

	svg {
		width: 100%;
		height: 100%; /* Fill the height of the wrapper */
	}
	

	.map {
		/* width: 100%; */
		/* height: 100%; */
		background-color: transparent;
		/* justify-content: center; */
		/* align-items: center; */
	}

	#map-group {
		pointer-events: all;
		cursor: pointer;
	}

	/* #map-group path {
        cursor: pointer;
        transition: all 0.3s ease;
        stroke: #ffffff;
        stroke-width: 0.5;
        fill: #4a4a4a;
    }

    #map-group path:hover,
    #map-group path.hovered {
        fill: #ff9900;
        filter: drop-shadow(0 0 5px rgba(255, 153, 0, 0.7));
    }

    .reset-zoom {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 10px;
        background-color: #f0f0f0;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    } */

	.grid path {
		stroke: rgba(255, 255, 255, 0.1);
		stroke-width: 0.5;
	}

	path {
		cursor: pointer;
		transition: opacity 0.3s ease;
	}

	path:hover {
		fill: #d0d0d0;
	}
	/* 
    image {
        opacity: 0.6;
        transition: opacity 0.3s ease;
        position: absolute;
        background-color: red;

    } */

	/* image:hover {
        opacity: 0.8;
    } */

	.footer {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content:flex-end;
		z-index: 1;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		gap: 1rem;
	}
	/* 
    .reset-zoom {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 10px;
        background-color: #f0f0f0;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    } */

	.left-edge,
	.right-edge {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 20px;
		background: linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.left-edge {
		left: 0;
	}

	.right-edge {
		right: 0;
	}

	button {
		background-color: transparent;
		color: lightgray;
		border: none;
		cursor: pointer;
		transition: background-color 0.3s;

		&:hover {
			background-color: #2c3e50;
			transform: scale(1.05);
			border-radius: var(--radius-m);
		}
		&:active {
			transform: scale(0.95);
		}

		& span {
			height: 50px;
			width: 100%;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			gap: 0.5rem;


		}

	}


	span.zoom-controls {
		bottom: 1rem;
		left: 50%;
		/* transform: translateX(-50%); */
		display: flex;
		gap: 0.5rem;
		background: var(--primary-color);
		z-index: 3;
		align-items: center;
		user-select: none;
		border-radius: 20px;
		transition:
			background-color 0.3s,
			transform 0.1s;
		font-weight: bold;
		padding: 8px 15px;

		
	}

	span {
		font-weight: bold;
		min-width: 50px;
		text-align: center;
		color: white;

	}

	/* 
    .shapes g {
        transition: all 0.3s ease;
    } */

	/* .shapes g:hover {
        filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
    } */

	/* .controls {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 1000;
    }

    .controls button {
        padding: 5px 10px;
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .controls button:hover {
        background-color: rgba(255, 255, 255, 0.3);
    } */

	.shape-container {
		position: absolute;
		border-radius: 30px;
		background-color: transparent;
		border: 4px solid transparent;
		transition: all 0.6s cubic-bezier(0.075, 0.82, 0.165, 1);
		user-select: none;
		cursor: move;
	}

	.shape-container:hover {
		/* border: 2px solid #2c3e50; */
		/* color: white; */
		cursor: pointer;
		/* border-style:outset; */
		border: 20px solid #6a6a6a;
	}

	.shape-container.selected {
		border: 20px solid #3498db; /* Example: blue border when selected */
		background-color: rgba(52, 152, 219, 0.1); /* Optional: Add a background color */
	}

	.connection-point {
		position: absolute;
		width: 10px;
		height: 10px;
		background-color: #007bff;
		border-radius: 50%;
		cursor: pointer;
	}

	.shape-content {
		pointer-events: none;
	}

	.top {
		top: -5px;
		left: 50%;
		transform: translateX(-50%);
	}
	.right {
		top: 50%;
		right: -5px;
		transform: translateY(-50%);
	}
	.bottom {
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
	}
	.left {
		top: 50%;
		left: -5px;
		transform: translateY(-50%);
	}
</style>
