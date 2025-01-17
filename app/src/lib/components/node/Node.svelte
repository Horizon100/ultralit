<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Node, Transform } from '$lib/types/types';
    import { Network, ClipboardList, MessageSquare, Settings } from 'lucide-svelte';
    import AIChat from '$lib/components/ai/AIChat.svelte';
    import Kanban from '../features/Kanban.svelte';
    import { User, Save } from 'lucide-svelte';
    import CircleMap from '../network/CircleMap.svelte';
    import NodeChat from './NodeChat.svelte';
    import { fade } from 'svelte/transition';
    import { saveNode } from '$lib/nodeClient';



    export let node: Node;
    export let transform: Transform;

    const dispatch = createEventDispatcher();

    let activeContent: 'chat' | 'info' | 'settings' | 'connections' = 'chat';
  
    $: isNodeOptionsView = transform.scale === 2.5;
    $: style = `
        left: ${isNodeOptionsView && node.expanded ? '90px' : node.x * transform.scale + transform.offsetX + 'px'};
        top: ${isNodeOptionsView && node.expanded ? '90px' : node.y * transform.scale + transform.offsetY + 'px'};
        width: ${isNodeOptionsView && node.expanded ? '34%' : node.expanded ? '400px' : '200px'};
        height: ${isNodeOptionsView && node.expanded ? '32%' : node.expanded ? '300px' : '100px'};
        transform: scale(${transform.scale});
        transform-origin: top left;
    `;

    $: {
        if (!node.expanded) {
        activeContent = 'chat';
        }
    }
    function handleClick() {
      dispatch('click');
    }
  
    function handleMouseDown(event: MouseEvent) {
      dispatch('mousedown', event);
    }
  
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ') {
        dispatch('click');
    }
    }
  
    function handleContentChange(content: typeof activeContent) {
    activeContent = content;
    if (!node.expanded) {
      dispatch('expand');
    }
  }

  async function handleSave() {
    try {
      await saveNode(node);
      console.log('Node saved successfully');
    } catch (error) {
      console.error('Error saving node:', error);
    }
  }

  $: expandedClass = node.expanded ? 'expanded' : '';
</script>
  
<div 
    class="node {expandedClass}"
    class:full-screen={isNodeOptionsView && node.expanded}
    {style} 
    on:mousedown={handleMouseDown}
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-expanded={node.expanded}
    >
    <div class="handle">
        <div class="title">
            <User size={24} color="#596363" />
            <h2>Agent</h2>
        </div> 
        <h3>{node.seedPrompt}</h3>

    </div>
    <div class="button-row">
        <button 
        class:active={activeContent === 'chat'} 
        on:click|stopPropagation={() => handleContentChange('chat')}
        >
        <MessageSquare size="24" color="#596363" />

        </button>
        <button 
        class:active={activeContent === 'info'} 
        on:click|stopPropagation={() => handleContentChange('info')}
        >
        <ClipboardList size="24" color="#596363" />
        </button>
        <button 
        class:active={activeContent === 'settings'} 
        on:click|stopPropagation={() => handleContentChange('settings')}
        >
        <Settings size="24" color="#596363" />
        </button>
        <button 
        class:active={activeContent === 'connections'} 
        on:click|stopPropagation={() => handleContentChange('connections')}
        >
        <Network size="24" color="#596363" />
        </button>
        <button class="save-button" on:click|stopPropagation={handleSave}>
            <Save size={20} color="#596363" />
        </button>
    </div>
    {#if node.expanded && activeContent !== null}
    <div class="content">
        {#if activeContent === 'chat'}
        <NodeChat/>
        {:else if activeContent === 'info'}
        <Kanban/>
        {:else if activeContent === 'settings'}
        <p>Node settings here</p>
        {:else if activeContent === 'connections'}
        <CircleMap/>
        {/if}
    </div>
    {/if}
</div>
  

<style>
  .node {
        position: fixed;
        display: flex;
        flex-direction: column;
        background-color: #353f3f;
        border: 1px solid #ccc;
        border-radius: 20px;
        padding: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        transition:  0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        overflow: hidden;
        cursor: move;
    }

    .node:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
        z-index: 1001;
    }

    .node:hover {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); /* Enhanced shadow for deeper effect */

    }

    .node.expanded {
        background-color: #353f3f;
        z-index: 1002;
    }

    .node.full-screen {
        position: fixed;
        z-index: 1003;
        background-color: #353f3f;

    }

    h2 {
        /* margin: 0 0 10px 0; */
        font-size: 16px;
        font-family:Georgia, 'Times New Roman', Times, serif;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        justify-content: center;
        color: lightgray;

    }


    h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: lightgray;
    }


    .button-row {
        display: flex;
        margin-top: 10px;

    }

    .button-row button {
        background-color: #353f3f;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .button-row button:hover {
        background-color: #e0e0e0;
    }

    .button-row button.active {
        background-color: #d0d0d0;
        font-weight: bold;
    }

    .content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        height: calc(100% - 70px); /* Adjust based on your title and button row height */
        overflow-y: auto;
        background-color: #2a3130;
        padding-left: 20px;
        border-radius: 20px;
        color: white;

    }

    .handle {
        display: flex;
        color: white;
        padding: 0 5px 0 5px;
        flex-direction: column;
        background-color: #2a3130;
        border-radius: 20px;

        /* justify-content: center; */
        /* align-items: center; */
    }
    

    .title {
        display: flex;
        height: 25px;
        /* justify-content: center; */
        align-items: center;
        flex-direction: row;
        gap: 10px;
    }

    .save-button {
    position: absolute;
    bottom: 10px;
    right: 10px;
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    background-color: #f0f0f0;
    transition: background-color 0.3s;
  }

  .save-button:hover {
    background-color: #e0e0e0;
  }

</style>