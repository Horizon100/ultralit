<!-- src/lib/components/DashboardGrid.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { dashboardLayoutStore } from '$lib/features/webrtc/stores/dashboard-store';
	import type { ComponentType } from 'svelte';
	
	export let isEditMode = false;
	export let availableComponents: Array<{
		id: string;
		component: ComponentType;
		title: string;
		defaultSize: { w: number; h: number };
	}>;
	
	let gridContainer: HTMLDivElement;
	let draggedItem: string | null = null;
	let resizingItem: string | null = null;
	let resizeHandle: string | null = null;
	let dragOffset = { x: 0, y: 0 };
	let initialMousePos = { x: 0, y: 0 };
	let initialItemData = { x: 0, y: 0, w: 0, h: 0 };
	
	// Grid configuration
	const GRID_COLS = 12;
	const GRID_ROWS = 8;
	const CELL_HEIGHT = 80;
	const GAP = 8;
	
	$: layout = $dashboardLayoutStore;
	
	function getGridPosition(clientX: number, clientY: number) {
		if (!gridContainer) return { x: 0, y: 0 };
		
		const rect = gridContainer.getBoundingClientRect();
		const relativeX = clientX - rect.left;
		const relativeY = clientY - rect.top;
		
		const cellWidth = (rect.width - GAP * (GRID_COLS - 1)) / GRID_COLS;
		const cellHeight = CELL_HEIGHT;
		
		const gridX = Math.floor(relativeX / (cellWidth + GAP));
		const gridY = Math.floor(relativeY / (cellHeight + GAP));
		
		return {
			x: Math.max(0, Math.min(GRID_COLS - 1, gridX)),
			y: Math.max(0, Math.min(GRID_ROWS - 1, gridY))
		};
	}
	  function checkCollision(itemId: string, newX: number, newY: number, newW: number, newH: number) {
        const itemRect = { x: newX, y: newY, w: newW, h: newH };
        
        return layout.some(item => {
            if (item.id === itemId) return false;
            
            return (
                itemRect.x < item.x + item.w &&
                itemRect.x + itemRect.w > item.x &&
                itemRect.y < item.y + item.h &&
                itemRect.y + itemRect.h > item.y
            );
        });
    }
	function handleDragStart(event: DragEvent, itemId: string) {
		if (!isEditMode) return;
		event.preventDefault();
	}
	
	function handleMouseDown(event: MouseEvent, itemId: string) {
		if (!isEditMode) return;
		
		const target = event.target as HTMLElement;
		if (target.classList.contains('resize-handle')) return;
		
		event.preventDefault();
		draggedItem = itemId;
		
		const item = layout.find(item => item.id === itemId);
		if (!item) return;
		
		initialMousePos = { x: event.clientX, y: event.clientY };
		initialItemData = { ...item };
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}
	
    function handleMouseMove(event: MouseEvent) {
        if (!draggedItem && !resizingItem) return;
        
        if (draggedItem) {
            const deltaX = event.clientX - initialMousePos.x;
            const deltaY = event.clientY - initialMousePos.y;
            
            const newPosition = getGridPosition(
                initialMousePos.x + deltaX,
                initialMousePos.y + deltaY
            );
            
            const item = layout.find(item => item.id === draggedItem);
            if (!item) return;
            
            // Calculate potential new position
            let newX = newPosition.x;
            let newY = newPosition.y;
            const itemW = item.w;
            const itemH = item.h;
            
            // Boundary checks
            newX = Math.max(0, Math.min(GRID_COLS - itemW, newX));
            newY = Math.max(0, Math.min(GRID_ROWS - itemH, newY));
            
            // Collision detection and snapping
            if (checkCollision(draggedItem, newX, newY, itemW, itemH)) {
                // Try snapping to nearby positions
                const directions = [
                    { dx: 1, dy: 0 },  // right
                    { dx: -1, dy: 0 }, // left
                    { dx: 0, dy: 1 },  // down
                    { dx: 0, dy: -1 }, // up
                ];
                
                for (const dir of directions) {
                    const testX = newX + dir.dx;
                    const testY = newY + dir.dy;
                    
                    if (
                        testX >= 0 && testX <= GRID_COLS - itemW &&
                        testY >= 0 && testY <= GRID_ROWS - itemH &&
                        !checkCollision(draggedItem, testX, testY, itemW, itemH)
                    ) {
                        newX = testX;
                        newY = testY;
                        break;
                    }
                }
            }
            
            // Only update if position changed
            if (newX !== item.x || newY !== item.y) {
                dashboardLayoutStore.updateComponentPosition(draggedItem, { x: newX, y: newY });
            }
        }
        
        if (resizingItem && resizeHandle) {
            handleResize(event);
        }
    }
	
	function handleMouseUp() {
		draggedItem = null;
		resizingItem = null;
		resizeHandle = null;
		
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}
	
	function handleResizeStart(event: MouseEvent, itemId: string, handle: string) {
		if (!isEditMode) return;
		
		event.preventDefault();
		event.stopPropagation();
		
		resizingItem = itemId;
		resizeHandle = handle;
		
		const item = layout.find(item => item.id === itemId);
		if (!item) return;
		
		initialMousePos = { x: event.clientX, y: event.clientY };
		initialItemData = { ...item };
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}
	
	function handleResize(event: MouseEvent) {
        if (!resizingItem || !resizeHandle) return;
		
		const deltaX = event.clientX - initialMousePos.x;
		const deltaY = event.clientY - initialMousePos.y;
		
		const rect = gridContainer.getBoundingClientRect();
		const cellWidth = (rect.width - GAP * (GRID_COLS - 1)) / GRID_COLS;
		
		const gridDeltaX = Math.round(deltaX / (cellWidth + GAP));
		const gridDeltaY = Math.round(deltaY / (CELL_HEIGHT + GAP));
		
		let newW = initialItemData.w;
		let newH = initialItemData.h;
		let newX = initialItemData.x;
		let newY = initialItemData.y;
		
		switch (resizeHandle) {
			case 'se': // Southeast - resize width and height
				newW = Math.max(1, Math.min(GRID_COLS - initialItemData.x, initialItemData.w + gridDeltaX));
				newH = Math.max(1, Math.min(GRID_ROWS - initialItemData.y, initialItemData.h + gridDeltaY));
				break;
			case 'e': // East - resize width only
				newW = Math.max(1, Math.min(GRID_COLS - initialItemData.x, initialItemData.w + gridDeltaX));
				break;
			case 's': // South - resize height only
				newH = Math.max(1, Math.min(GRID_ROWS - initialItemData.y, initialItemData.h + gridDeltaY));
				break;
			case 'sw': // Southwest - resize width and height, adjust x
				newW = Math.max(1, initialItemData.w - gridDeltaX);
				newH = Math.max(1, Math.min(GRID_ROWS - initialItemData.y, initialItemData.h + gridDeltaY));
				newX = Math.max(0, initialItemData.x + (initialItemData.w - newW));
				break;
			case 'w': // West - resize width, adjust x
				newW = Math.max(1, initialItemData.w - gridDeltaX);
				newX = Math.max(0, initialItemData.x + (initialItemData.w - newW));
				break;
			case 'nw': // Northwest - resize width and height, adjust x and y
				newW = Math.max(1, initialItemData.w - gridDeltaX);
				newH = Math.max(1, initialItemData.h - gridDeltaY);
				newX = Math.max(0, initialItemData.x + (initialItemData.w - newW));
				newY = Math.max(0, initialItemData.y + (initialItemData.h - newH));
				break;
			case 'n': // North - resize height, adjust y
				newH = Math.max(1, initialItemData.h - gridDeltaY);
				newY = Math.max(0, initialItemData.y + (initialItemData.h - newH));
				break;
			case 'ne': // Northeast - resize width and height, adjust y
				newW = Math.max(1, Math.min(GRID_COLS - initialItemData.x, initialItemData.w + gridDeltaX));
				newH = Math.max(1, initialItemData.h - gridDeltaY);
				newY = Math.max(0, initialItemData.y + (initialItemData.h - newH));
				break;
		}
        if (checkCollision(resizingItem, newX, newY, newW, newH)) {
            return;
        }

		
		dashboardLayoutStore.updateComponentSize(resizingItem, { w: newW, h: newH });
		if (newX !== initialItemData.x || newY !== initialItemData.y) {
			dashboardLayoutStore.updateComponentPosition(resizingItem, { x: newX, y: newY });
		}
	}
	
	function toggleComponent(componentId: string) {
		dashboardLayoutStore.toggleComponent(componentId);
	}
	
	function getGridStyle(item: any) {
		return `
			grid-column: ${item.x + 1} / span ${item.w};
			grid-row: ${item.y + 1} / span ${item.h};
		`;
	}
	
	onMount(() => {
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	});
</script>

<div class="dashboard-grid-container">
	{#if isEditMode}
		<div class="edit-toolbar">
			<h3>Available Components</h3>
			<div class="component-toggles">
				{#each availableComponents as comp}
					<label class="toggle-item">
						<input 
							type="checkbox" 
							checked={layout.some(item => item.id === comp.id)}
							on:change={() => toggleComponent(comp.id)}
						/>
						<span>{comp.title}</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}
	
	<div 
		class="dashboard-grid" 
		class:edit-mode={isEditMode}
		bind:this={gridContainer}
		style="grid-template-columns: repeat({GRID_COLS}, 1fr); grid-template-rows: repeat({GRID_ROWS}, {CELL_HEIGHT}px); gap: {GAP}px;"
	>
		{#each layout as item (item.id)}
			{@const componentDef = availableComponents.find(c => c.id === item.id)}
			{#if componentDef}
				<div 
					class="grid-item"
					class:draggable={isEditMode}
					class:dragging={draggedItem === item.id}
					class:resizing={resizingItem === item.id}
					style={getGridStyle(item)}
					on:mousedown={(e) => handleMouseDown(e, item.id)}
					role="button"
					tabindex={isEditMode ? 0 : -1}
				>
					<div class="grid-item-header">
						<h4>{componentDef.title}</h4>
						{#if isEditMode}
							<div class="item-controls">
								<button class="remove-btn" on:click|stopPropagation={() => toggleComponent(item.id)} title="Remove">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/if}
					</div>
					
					<div class="grid-item-content">
						<svelte:component this={componentDef.component} compact={true} />
					</div>
					
					{#if isEditMode}
						<!-- Resize handles -->
						<div class="resize-handles">
							<!-- Corner handles -->
							<div 
								class="resize-handle nw"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'nw')}
								title="Resize northwest"
							></div>
							<div 
								class="resize-handle ne"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'ne')}
								title="Resize northeast"
							></div>
							<div 
								class="resize-handle sw"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'sw')}
								title="Resize southwest"
							></div>
							<div 
								class="resize-handle se"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'se')}
								title="Resize southeast"
							></div>
							
							<!-- Edge handles -->
							<div 
								class="resize-handle n"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'n')}
								title="Resize north"
							></div>
							<div 
								class="resize-handle s"
								on:mousedown={(e) => handleResizeStart(e, item.id, 's')}
								title="Resize south"
							></div>
							<div 
								class="resize-handle w"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'w')}
								title="Resize west"
							></div>
							<div 
								class="resize-handle e"
								on:mousedown={(e) => handleResizeStart(e, item.id, 'e')}
								title="Resize east"
							></div>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.dashboard-grid-container {
		flex: 1;
		padding: 1rem;
		overflow: auto;
	}
	
	.edit-toolbar {
		background: #111;
		border: 1px solid #333;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	
	.edit-toolbar h3 {
		color: white;
		margin: 0 0 1rem 0;
		font-size: 1rem;
	}
	
	.component-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	
	.toggle-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #94a3b8;
		cursor: pointer;
	}
	
	.toggle-item input[type="checkbox"] {
		accent-color: #667eea;
	}
	
	.dashboard-grid {
		display: grid;
		height: fit-content;
		min-height: 600px;
		position: relative;
	}
	
	.grid-item {
		background: #111;
		border: 1px solid #333;
		border-radius: 0.5rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
	}
	
	.grid-item.draggable {
		cursor: move;
	}
	
	.grid-item.dragging {
		transform: scale(1.02);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
		z-index: 1000;
		border-color: #667eea;
	}
	
	.grid-item.resizing {
		transition: none;
		border-color: #10b981;
	}
	
	.grid-item:hover {
		border-color: #667eea;
	}
	
	.grid-item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		position: relative;
		z-index: 10;
	}
	
	.grid-item-header h4 {
		color: white;
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		pointer-events: none;
	}
	
	.item-controls {
		display: flex;
		gap: 0.5rem;
	}
	
	.remove-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.25rem;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.remove-btn:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}
	
	.grid-item-content {
		flex: 1;
		overflow: hidden;
		position: relative;
	}
	
	.edit-mode .grid-item {
		border-style: dashed;
	}
	
	/* Resize handles */
	.resize-handles {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 20;
	}
	
	.resize-handle {
		position: absolute;
		background: #667eea;
		pointer-events: all;
		transition: all 0.2s;
		opacity: 0;
	}
	
	.grid-item:hover .resize-handle {
		opacity: 1;
	}
	
	/* Corner handles */
	.resize-handle.nw {
		top: -4px;
		left: -4px;
		width: 8px;
		height: 8px;
		cursor: nw-resize;
		border-radius: 50%;
	}
	
	.resize-handle.ne {
		top: -4px;
		right: -4px;
		width: 8px;
		height: 8px;
		cursor: ne-resize;
		border-radius: 50%;
	}
	
	.resize-handle.sw {
		bottom: -4px;
		left: -4px;
		width: 8px;
		height: 8px;
		cursor: sw-resize;
		border-radius: 50%;
	}
	
	.resize-handle.se {
		bottom: -4px;
		right: -4px;
		width: 8px;
		height: 8px;
		cursor: se-resize;
		border-radius: 50%;
	}
	
	/* Edge handles */
	.resize-handle.n {
		top: -2px;
		left: 20%;
		right: 20%;
		height: 4px;
		cursor: n-resize;
		border-radius: 2px;
	}
	
	.resize-handle.s {
		bottom: -2px;
		left: 20%;
		right: 20%;
		height: 4px;
		cursor: s-resize;
		border-radius: 2px;
	}
	
	.resize-handle.w {
		left: -2px;
		top: 20%;
		bottom: 20%;
		width: 4px;
		cursor: w-resize;
		border-radius: 2px;
	}
	
	.resize-handle.e {
		right: -2px;
		top: 20%;
		bottom: 20%;
		width: 4px;
		cursor: e-resize;
		border-radius: 2px;
	}
	
	.resize-handle:hover {
		background: #10b981;
		transform: scale(1.2);
	}
	
	/* Smooth transitions for grid changes */
	.dashboard-grid:not(.edit-mode) .grid-item {
		transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	/* Grid overlay for better visual feedback during editing */
	.edit-mode::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: 
			linear-gradient(to right, rgba(102, 126, 234, 0.1) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
		background-size: calc(100% / 12) 80px;
		pointer-events: none;
		z-index: 1;
	}
</style>