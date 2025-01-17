<script lang="ts">
  import { onMount, createEventDispatcher, afterUpdate, onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import Node from '../../lib/components/node/Node.svelte';
  import CanvasControls from '../../lib/components/canvas/CanvasControls.svelte';
  import NodeCreationModal from '../../lib/components/node/NodeCreationModal.svelte';
  import type { AIModel, NetworkData, Node as NodeType, Transform, TextFile} from '$lib/types/types';
  import NetworkGenerator from '../../lib/components/network/NetworkGenerator.svelte';
  import NetworkVisualization from '$lib/components/network/NetworkVisualization.svelte';
  import Icicle from '../../lib/components/network/Icicle.svelte';
  import { nodeStore } from '../../lib/stores/nodeStore';
  import StickerCreator from '../../lib/components/features/StickerCreator.svelte';
  import { cursorPositions, initializeCursorStore, updateCursorPosition, cleanupCursorStore } from '$lib/stores/cursorStore';
  import CursorComponent from '../../lib/components/canvas/CursorComponent.svelte';
  import { currentUser } from '$lib/pocketbase';
  import CursorEffect from '$lib/components/canvas/CursorEffect.svelte';
  import FileContainer from '../../lib/components/canvas/FileContainer.svelte';
  import ImportDocs from '../../lib/components/features/ImportDocs.svelte';
  import Agent from '$lib/components/ai/Agent.svelte';
  import type { AIAgent } from '$lib/types/types';
  import { createAgent, getAgentById, updateAgent, deleteAgent } from '$lib/clients/agentClient';
  import { agentStore } from '../../lib/stores/agentStore';


  console.log('Script start');

  interface StickerCreatorProps {
    x: number;
    y: number;
  }

  // Variables
  let containerDiv: HTMLElement;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvasRect: DOMRect;
  let canvasReady = false;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  

  let fileInput: HTMLInputElement;
  let text = '';

  // Stickers
  let showStickerCreator = false;
  let stickerX: number = 0;
  let stickerY: number = 0;

  // Import
  let uploadedFiles: Array<{ file: File, x: number, y: number }> = [];
  let showImportDocs = false;
  let importX = 0;
  let importY = 0;

  // Nodes
  let nodes: NodeType[] = [];
  let showNodeCreation = false;
  let newNodeX = 0;
  let newNodeY = 0;
  let networkData: NetworkData | null = null;

  // Context menu
  let showContextMenu = false;
  let showSingleClickMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let menuX = 0;
  let menuY = 0;
  let isNodeContextMenu = false;
  let showActionMenu = false;

  //Agents
  let agents: AIAgent[] = [];


  let showAgentCreation = false;

  let newAgentX = 0;
  let newAgentY = 0;
  

  // Generators
  let summary = '';
  let showNetworkGenerator = false;

  // Views
  let isIcicleView = false;
  let isAgentView = false;

  let isTransitioning = false;
  let activeContent = '';
  let icicleScale = 1;
  let currentZoomIndex = 1;
  export let aiModel: AIModel;

 
  // Constants
  const dispatch = createEventDispatcher();
  const zoomLevels = [0.5, 1, 2.5];
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const ZOOM_SENSITIVITY = 0.0005;
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;
  const NODE_GAP = 50;

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.document',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.spreadsheet',
    'audio/*',
    'video/*',
    'text/plain',
    'text/csv',
    'application/json',
    'text/javascript',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  // Stores
  function handleSummaryGeneration(event: CustomEvent<string>) {
    summary = event.detail;
    showNetworkGenerator = true;
  }

  const scale = tweened(1, {
    duration: 300,
    easing: cubicOut
  });

  const offset = tweened({ x: 0, y: 0 }, {
    duration: 300,
    easing: cubicOut
  });

  $: transform = {
    scale: $scale,
    offsetX: $offset.x,
    offsetY: $offset.y
  };

  $: icicleData = convertNodesToIcicleData(nodes);
  
  nodeStore.subscribe((value: NodeType[]) => {
    nodes = value;
  });

    agentStore.subscribe((value: { agents: AIAgent[]; updateStatus: string }) => {
      agents = Array.isArray(value.agents) ? value.agents : [];
  });

  onMount(() => {
    console.log('onMount start');
    initializeCursorStore();
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvasReady = true;
      canvasRect = canvas.getBoundingClientRect();
      resizeCanvas();
      draw();
    }
    console.log('onMount end');

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('click', handleClickOutside);
    };
  });

  onDestroy(() => {
    cleanupCursorStore();
  });

  afterUpdate(() => {
    if (canvasReady) {
      resizeCanvas();
    }
  });

  function resizeCanvas() {
    if (!canvasReady || !containerDiv || !canvas) return;

    const rect = containerDiv.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    draw();
  }

  // Drawing
  function draw() {
    if (!canvasReady || !ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isIcicleView) {
      ctx.setTransform($scale, 0, 0, $scale, $offset.x, $offset.y);
      drawGrid();
    }
    
    dispatch('transform', transform);
  }

//   function repositionAgents() {
//     const agentElements = document.querySelectorAll('.agent');
//     const agentRects = Array.from(agentElements).map(el => el.getBoundingClientRect());

//     for (let i = 0; i < agentRects.length; i++) {
//         for (let j = i + 1; j < agentRects.length; j++) {
//             if (checkCollision(agentRects[i], agentRects[j])) {
//                 // Move the second agent to avoid overlap
//                 const agent = agents[j];
//                 agent.x += 50; // Move right
//                 agent.y += 50; // Move down
//                 updateAgent(agent.id, { x: agent.x, y: agent.y });
//             }
//         }
//     }
// }

// function checkCollision(rect1: DOMRect, rect2: DOMRect) {
//     return !(rect1.right < rect2.left || 
//              rect1.left > rect2.right || 
//              rect1.bottom < rect2.top || 
//              rect1.top > rect2.bottom);
// }

// Call repositionAgents after creating a new agent or on canvas resize

  function drawGrid() {
    if (!ctx || !canvas) return;

    const gridSize = 50;
    const offsetX = $offset.x % gridSize;
    const offsetY = $offset.y % gridSize;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.lineWidth = 1;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }

    for (let y = offsetY; y < canvas.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }

    ctx.stroke();
  }

  // Event Handlers
  function handleWheel(event: WheelEvent) {
    if (activeContent === 'chat') {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 'in' : 'out';
    zoom(direction);
  }

  function handleMouseDown(event: MouseEvent) {
    console.log('handleMouseDown called', { button: event.button, showNodeCreation, isIcicleView });
    if (showNodeCreation || isIcicleView) return;
    if (event.button === 2) {
      handleContextMenu(event);
    } else if (event.button === 1) {  // Middle mouse button
      console.log('Middle mouse button clicked');
      event.preventDefault();  // Prevent default scrolling behavior
      handleActionMenu(event);
    } else {
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }


  async function handleMouseMove(event: MouseEvent) {
    if (showNodeCreation || !isDragging || isIcicleView) return;
    
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    
    agents = agents.map(agent => {
      const position = typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position;
      const newX = position.x + deltaX / $scale;
      const newY = position.y + deltaY / $scale;
      if (newX !== position.x || newY !== position.y) {
        return { ...agent, position: { x: newX, y: newY }, hasMoved: true };
      }
      return agent;
    });
    
    lastX = event.clientX;
    lastY = event.clientY;

    if ($currentUser) {
        const x = (event.clientX - canvasRect.left - $offset.x) / $scale;
        const y = (event.clientY - canvasRect.top - $offset.y) / $scale;
        await updateCursorPosition($currentUser.id, x, y, $currentUser.name || $currentUser.username || $currentUser.email);
    }
}

function handleMouseUp() {
  isDragging = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  
  // Update all agents that have moved
  agents.forEach(agent => {
    if (agent.hasMoved) {
      agentStore.updateAgent(agent.id, { position: agent.position });
      updateAgent(agent.id, { position: agent.position }).catch(error => {
        console.error('Failed to update agent position in backend:', error);
      });
      agent.hasMoved = false;
    }
  });
}

  function handleDoubleClick(event: MouseEvent) {
    if (showNodeCreation || isIcicleView || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    newNodeX = (event.clientX - rect.left - $offset.x) / $scale;
    newNodeY = (event.clientY - rect.top - $offset.y) / $scale;

    showNodeCreation = true;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleNodeCreationCancel();
    }
  }

  // Zooming

  function handleZoom(direction: 'in' | 'out') {
    zoom(direction);
  }

  async function zoom(direction: 'in' | 'out') {
    if (isTransitioning || !canvasReady || !canvas) return;

    isTransitioning = true;

    if (isIcicleView) {
      if (direction === 'out' && icicleScale <= 0.6) {
        await transitionToAgentView(1);
      } else {
        icicleScale = direction === 'in' ? icicleScale * 1.2 : icicleScale / 1.2;
        icicleScale = Math.max(0.5, Math.min(icicleScale, 2));
      }
    } else {
      let newZoomIndex = currentZoomIndex;
      if (direction === 'in' && currentZoomIndex < zoomLevels.length - 1) {
        newZoomIndex++;
      } else if (direction === 'out' && currentZoomIndex > 0) {
        newZoomIndex--;
      }

      const newScale = zoomLevels[newZoomIndex];
      
      if (newScale === 0.5) {
        await transitionToIcicleView();
      } else {
        await zoomToScale(newScale, canvas.width / 2, canvas.height / 2);
      }

      currentZoomIndex = newZoomIndex;
    }

    isTransitioning = false;
    draw();
  }

  async function transitionToIcicleView() {
    const duration = 500;
    await scale.set(0.5, { duration });
    isIcicleView = true;
    icicleScale = 1;
  }

  async function transitionToAgentView(newScale: number) {
    const duration = 500;
    isIcicleView = false;
    icicleScale = 1;
    currentZoomIndex = zoomLevels.findIndex(scale => scale === newScale);
    await scale.set(newScale, { duration });
    await offset.set({ x: 0, y: 0 }, { duration });
    resetView();
  }

  async function zoomToScale(newScale: number, centerX: number, centerY: number) {
    if (!canvas) return;

    const wx = (centerX - $offset.x) / $scale;
    const wy = (centerY - $offset.y) / $scale;
    
    const newOffsetX = centerX - wx * newScale;
    const newOffsetY = centerY - wy * newScale;
    
    await Promise.all([
      scale.set(newScale, { duration: 200 }),
      offset.set({ x: newOffsetX, y: newOffsetY }, { duration: 200 })
    ]);

    draw();
  }

  // Node Views
  function handleCanvasClick(event: MouseEvent) {
    const clickedAgent = (event.target as Element).closest('.agent');
    if (!clickedAgent) {
        agents.forEach(agent => {
            if (agent.expanded) {
                agentStore.updateAgent(agent.id, { expanded: false });
            }
        });
    }
    isDragging = false;
}


  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    showAndPositionMenu(event, 'context');
  }
  
  function handleActionMenu(event: MouseEvent) {
    console.log('handleActionMenu called');
    const clickedAgent = (event.target as Element).closest('.agent');
    if (!clickedAgent) {
      console.log('No Agent clicked, showing action menu');
      showAndPositionMenu(event, 'action');
    } else {
      console.log('Agent clicked, not showing action menu');
    }
  }

function showAndPositionMenu(event: MouseEvent, type: 'action' | 'context') {
    console.log('showAndPositionMenu called', { type, canvas: !!canvas });
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    menuX = event.clientX - rect.left;
    menuY = event.clientY - rect.top;
    
    console.log('Menu position calculated', { menuX, menuY });

    if (type === 'action') {
      showActionMenu = true;
      showContextMenu = false;
      console.log('Action menu set to show');
    } else {
      showContextMenu = true;
      showActionMenu = false;
      console.log('Context menu set to show');
    }
    
    isNodeContextMenu = false;
    console.log('Final menu state', { showActionMenu, showContextMenu, isNodeContextMenu });
  }

function handleMenuAction(action: string) {
    console.log(`Menu action: ${action}`);
    showContextMenu = false;
    showActionMenu = false;
    
    if (action === 'create-node') {
      showNodeCreation = true;
      newNodeX = (menuX - $offset.x) / $scale;
      newNodeY = (menuY - $offset.y) / $scale;
    } else if (action === 'create-agent') {
      handleAgentCreation();
      newAgentX = (menuX - $offset.x) / $scale;
      newAgentY = (menuY - $offset.y) / $scale;
    } else if (action === 'sticker') {
      showStickerCreator = true;
      stickerX = (menuX - $offset.x) / $scale;
      stickerY = (menuY - $offset.y) / $scale;
    } else if (action === 'import') {
      fileInput.click();
    } else if (action === 'paste') {
      navigator.clipboard.readText().then(text => {
        const newFile = {
          type: 'text/plain',
          name: 'Pasted Text',
          content: text,
          lastModified: Date.now(),
          size: text.length
        } as unknown as File;
        handleFileUpload([newFile], menuX, menuY);
      });
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const menuElement = document.querySelector('.context-menu, .action-menu');
    if ((showContextMenu || showActionMenu) && menuElement && !menuElement.contains(event.target as Element)) {
      showContextMenu = false;
      showActionMenu = false;
    }
  }
  // Resets
  function resetView() {
    if (!canvas) return;

    const bounds = calculateNodesBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    scale.set(1);
    offset.set({ 
      x: canvas.width / 2 - centerX * $scale, 
      y: canvas.height / 2 - centerY * $scale 
    });
  }

  function handleIcicleZoom(event: CustomEvent<{ scale: number }>) {
    icicleScale = event.detail.scale;
  }

  function applyCanvasTransform(x: number, y: number) {
    return {
      x: (x - $offset.x) / $scale,
      y: (y - $offset.y) / $scale
    };
  }

  function reverseCanvasTransform(x: number, y: number) {
    return {
      x: x * $scale + $offset.x,
      y: y * $scale + $offset.y
    };
  }

  // Node Creation
  function calculateNodesBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT);
    });
    return { minX, minY, maxX, maxY };
  }

  function handleNodeCreationCancel() {
    showNodeCreation = false;
  }

  function handleCanvasKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleNodeCreationCancel();
    }
    // Add more keyboard controls as needed
  }

  function convertNodesToIcicleData(nodes: NodeType[]) {
    const root = {
      name: 'Root',
      children: nodes.map(node => ({
        name: node.title,
        value: 1,
        children: []
      }))
    };
    return root;
  }

  function handleNodeExpand(node: NodeType) {
    nodeStore.updateNode(node.id, { expanded: !node.expanded });
  }

  function handleNodeMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
    const { id, x, y } = event.detail;
    nodeStore.updateNode(id, { x, y });
  }

  // Importing documents
  async function handleFileUpload(files: File[], x: number, y: number) {
    try {
      console.log(`Attempting to upload ${files.length} file(s)`);
      
      const newUploadedFiles = files.map(file => {
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        return { file, x, y };
      });

      uploadedFiles = [...uploadedFiles, ...newUploadedFiles];
      
      console.log(`Successfully added ${newUploadedFiles.length} file(s) to uploadedFiles`);
      console.log(`Total files in uploadedFiles: ${uploadedFiles.length}`);
      
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
    }
  }

  function isTextFile(file: any): file is TextFile {
    return 'type' in file && 'name' in file && 'content' in file && 'lastModified' in file && 'size' in file;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.items) {
      for (let i = 0; i < event.dataTransfer.items.length; i++) {
        if (event.dataTransfer.items[i].kind === 'file') {
          const file = event.dataTransfer.items[i].getAsFile();
          if (file) {
            handleFileUpload([file], event.clientX, event.clientY);
          }
        } else if (event.dataTransfer.items[i].kind === 'string') {
          event.dataTransfer.items[i].getAsString(text => {
            const newFile = {
              type: 'text/plain',
              name: 'Dragged Text',
              content: text,
              lastModified: Date.now(),
              size: text.length
            } as unknown as File;
            handleFileUpload([newFile], event.clientX, event.clientY);
          });
        }
      }
    }
  }

  function handleFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      handleFileUpload(Array.from(input.files), contextMenuX, contextMenuY);
    }
    input.value = ''; // Reset the input
  }

  function handleFileMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
  const { id, x, y } = event.detail;
  uploadedFiles = uploadedFiles.map(file => 
    file.file.name === id ? { ...file, x, y } : file
  );
}
  
  function handleImportComplete(event: CustomEvent<File[]>) {
    handleFileUpload(event.detail, importX, importY);
    showImportDocs = false;
  }
  
  function handleImportCancel() {
    showImportDocs = false;
  }

  // Context Menu
  function handleContextMenuAction(action: string) {
    console.log(`Context menu action: ${action}`);
    showContextMenu = false;
    if (action === 'sticker') {
      showStickerCreator = true;
      stickerX = (contextMenuX - $offset.x) / $scale;
      stickerY = (contextMenuY - $offset.y) / $scale;
    } else if (action === 'import') {
      fileInput.click();
    } else if (action === 'paste') {
      navigator.clipboard.readText().then(text => {
        const newFile = {
          type: 'text/plain',
          name: 'Pasted Text',
          content: text,
          lastModified: Date.now(),
          size: text.length
        } as unknown as File;
        handleFileUpload([newFile], contextMenuX, contextMenuY);
      });
    } else if (action === 'create') {
      showNodeCreation = true;
      newNodeX = (contextMenuX - $offset.x) / $scale;
      newNodeY = (contextMenuY - $offset.y) / $scale;
    }
  }

  function handleSingleClickMenuAction(action: string) {
    console.log(`Single-click menu action: ${action}`);
    showSingleClickMenu = false;
  }

  // Sticker Creation
  function handleStickerCreation(event: CustomEvent) {
    const stickerData = event.detail;
    console.log('New sticker:', stickerData);
    showStickerCreator = false;
  }

  function handleStickerCreationCancel() {
    showStickerCreator = false;
  }

  function handleNodeCreation(event: CustomEvent<{ node: NodeType; networkData: NetworkData | null }>) {
    const newNode = event.detail.node;
    newNode.x = newNodeX;
    newNode.y = newNodeY;
    nodeStore.addNode(newNode);
    showNodeCreation = false;
    resetView();
  }


  async function handleAgentCreation() {
    try {
      const x = (menuX - $offset.x) / $scale;
      const y = (menuY - $offset.y) / $scale;
      console.log('Calculated agent position:', { x, y });

      const newAgent: Partial<AIAgent> = {
        name: 'New Agent',
        prompt: 'Default prompt',
        position: { x, y }, // Change this line
        expanded: false,
        // Add other necessary properties
      };
      const createdAgent = await createAgent(newAgent);
      
      agentStore.addAgent(createdAgent);
      console.log('Agent created successfully:', createdAgent);
    } catch (error) {
      console.error('Error creating agent:', error);
    }
  }
  

  function handleAgentDelete(event: CustomEvent<string>) {
    const agentId = event.detail;
    agents = agents.filter(agent => agent.id !== agentId);
  }

  function handleAgentExpand(agent: AIAgent) {
    const updatedAgent = { ...agent, expanded: !agent.expanded };      
    agentStore.updateAgent(agent.id, { expanded: updatedAgent.expanded });
    updateAgent(agent.id, { expanded: updatedAgent.expanded }).catch(error => {
        console.error('Failed to update agent expansion in backend:', error);
        agentStore.updateAgent(agent.id, { expanded: agent.expanded }); // Revert to original state if update fails
    });
    dispatch('expand');
  }

  function handleAgentMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
    const { id, x, y } = event.detail;
    agentStore.updateAgent(id, { position: { x, y } });
  }

  $: {
    console.log('Agents array updated:', agents);
  }


</script>

<svelte:window on:keydown={handleKeyDown} />

<section 

  bind:this={containerDiv} 
  class="canvas-container"
  role="application"
  aria-label="Interactive network canvas"
  on:click={handleCanvasClick}
  on:mousedown={handleMouseDown}
  on:contextmenu|preventDefault={handleContextMenu}
  on:wheel={handleWheel}
  on:dragover|preventDefault
  on:drop={handleDrop}
  on:keydown={handleCanvasKeyDown}
>
  <CursorEffect />

  {#each $cursorPositions.filter(cursor => cursor.user !== $currentUser?.id) as cursor (cursor.id)}
    <CursorComponent cursor={cursor} transform={{ scale: $scale, offsetX: $offset.x, offsetY: $offset.y }} />
  {/each}

  {#if isIcicleView}
    <div transition:fade={{ duration: 300 }}>
      <Icicle 
        data={icicleData} 
        scale={icicleScale}
        on:zoom={handleIcicleZoom}
      />
    </div>
  {:else}
    <canvas
      bind:this={canvas}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:dblclick={handleDoubleClick}
    />
    {#each nodes as node (node.id)}
      <Node 
        {node}
        transform={{scale: $scale, offsetX: $offset.x, offsetY: $offset.y}}
        on:click={() => handleNodeExpand(node)}
        on:expand={() => handleNodeExpand(node)}
        on:move={handleNodeMove}
      />
    {/each}
  {/if}

    <!-- {#if agents && agents.length > 0}
  {#each agents as agent (agent.id)}
    <Agent
      {agent}
      position={typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position}
      transform={{scale: $scale, offsetX: $offset.x, offsetY: $offset.y}}
      on:click={() => handleAgentExpand(agent)}
      on:expand={() => handleAgentExpand(agent)}
      on:move={handleAgentMove}
      on:delete={handleAgentDelete}
    />
  {/each}
{/if} -->

  <CanvasControls
    transform={{scale: $scale, offsetX: $offset.x, offsetY: $offset.y}}
    onZoom={handleZoom}
    onReset={resetView}
    {isIcicleView}
    {icicleScale}
  />

  {#each uploadedFiles as { file, x, y } (file.name)}
  <FileContainer 
    {file}
    {x}
    {y}
    transform={{scale: $scale, offsetX: $offset.x, offsetY: $offset.y}}
    on:move={handleFileMove}
  />
{/each}
  {#if showImportDocs}
    <ImportDocs
      x={importX * $scale + $offset.x}
      y={importY * $scale + $offset.y}
      on:complete={handleImportComplete}
      on:cancel={handleImportCancel}
    />
  {/if}

  {#if showContextMenu || showActionMenu}
  <div 
    class={showContextMenu ? 'context-menu' : 'action-menu'}
    style="left: {menuX}px; top: {menuY}px;"
    role="menu" 
  >
    {#if isNodeContextMenu}
      <button on:click={() => handleMenuAction('edit')}>Edit Node</button>
      <button on:click={() => handleMenuAction('delete')}>Delete Node</button>
    {:else if showActionMenu}
      <button on:click={() => handleMenuAction('create-node')}>Create Node</button>
      <button on:click={() => handleMenuAction('create-agent')}>Create Agent</button>
      <button on:click={() => handleMenuAction('sticker')}>Add Sticker</button>
      <button on:click={() => handleMenuAction('paste')}>Paste</button>
      <button on:click={() => handleMenuAction('import')}>Import File</button>
    {:else}
      <button on:click={() => handleMenuAction('sticker')}>Add Sticker</button>
      <button on:click={() => handleMenuAction('paste')}>Paste</button>
      <button on:click={() => handleMenuAction('import')}>Import File</button>
    {/if}
  </div>
{/if}

{#if showStickerCreator}
<StickerCreator
  x={stickerX * $scale + $offset.x}
  y={stickerY * $scale + $offset.y}
  on:create={handleStickerCreation}
  on:cancel={handleStickerCreationCancel}
/>
{/if}
<!-- 
  {#if showSingleClickMenu}
  <div 
    class="single-click-menu" 
    style="left: {singleClickMenuX}px; top: {singleClickMenuY}px;"
    role="menu" 
  >
    <button on:click={() => handleSingleClickMenuAction('create')}>Create Node</button>
    <button on:click={() => handleSingleClickMenuAction('paste')}>Paste</button>
    <button on:click={() => handleSingleClickMenuAction('import')}>Import File</button>
  </div>
{/if} -->

  <!-- {#if showStickerCreator}
    <StickerCreator
      x={stickerX * $scale + $offset.x}
      y={stickerY * $scale + $offset.y}
      on:create={handleStickerCreation}
      on:cancel={handleStickerCreationCancel}
    />
  {/if} -->

  <input
    bind:this={fileInput}
    type="file"
    accept={allowedTypes.join(',')}
    multiple
    on:change={handleFileInputChange}
    style="display: none;"
  />
</section>

{#if showNetworkGenerator}
  <NetworkGenerator {summary} {aiModel} userId={$currentUser?.id} />
{/if}

{#if showNodeCreation}
  <div 
    class="modal-overlay" 
    on:click|self={handleNodeCreationCancel}
    on:keydown={(e) => e.key === 'Escape' && handleNodeCreationCancel()}
    role="dialog"
    aria-label="Create new node"
  >
    <NodeCreationModal 
      x={newNodeX}
      y={newNodeY}
      aiModel={aiModel}
      userId={$currentUser?.id}
      on:create={handleNodeCreation}
      on:cancel={handleNodeCreationCancel}
    />
  </div>
{/if}



<style>


  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background-color: #eaece4;
    /* z-index: 100000; */
  }

  .canvas-container:focus {
    outline: 2px solid #4CAF50; /* Add a visible focus indicator */
  }

  canvas {
    width: 100%;
    height: 100%;
    cursor: move;
  }

  .context-menu {
    display: flex;
    flex-direction: row;
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .action-menu {
    display: flex;
    flex-direction: column;
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .context-menu button,
  .action-menu button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
  }
  .context-menu button:hover {
    background-color: #f0f0f0;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
  }

  
  
</style>