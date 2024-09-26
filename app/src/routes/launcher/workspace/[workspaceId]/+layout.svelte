<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { workspaceStore } from '$lib/stores/workspaceStore';
    import { workshopStore } from '$lib/stores/workshopStore';
    import { getWorkshops, createWorkshop, deleteWorkshop, updateWorkshop } from '$lib/workshopClient';
    import type { Workspaces, Workshops } from '$lib/types';
    import { wormhole } from '$lib/transitions/wormhole';
    import { fade, slide, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { Plus, ArrowLeft, List, Box, X, Trash2, Edit2, Hammer, Users, Bot } from 'lucide-svelte';
    import WorkshopOverlay from '$lib/components/overlays/WorkshopOverlay.svelte';
    import { spring } from 'svelte/motion';
    import { currentUser } from '$lib/pocketbase';
    import AgentsList from '$lib/components/overlays/AgentsList.svelte';

    let currentWorkspace: Workspaces | null = null;
    let workshops: Workshops[] = [];
    let isTransitioningBack = false;
    let selectedWorkshop: Workshops | null = null;
    let isEditing: { [key: string]: boolean } = {};
    let error: string | null = null;
    let containerRef: HTMLDivElement;
    let isDragging = false;
    let startX: number;
    let scrollLeft: number;
    let activeTab: 'workshops' | 'agents' = 'workshops';
    let activeWorkshop: string | null = null;
    
    let workshopCount = 0;
    let agentCount = 0;


    $: {
        const workspaceId = $page.params.workspaceId;
        workspaceStore.subscribe(state => {
        currentWorkspace = state.workspaces.find((w: Workspaces) => w.id === workspaceId) || null;
        });

        workshopStore.subscribe(workshops => {
        workshopCount = workshops.filter(w => w.workspace === workspaceId).length;
        });
    }

    const position = spring({ x: 0, y: 0 }, {
        stiffness: 0.2,
        damping: 0.4
    });

    onMount(async () => {
        if ($currentUser && $currentUser.id) {
            try {
                const workspaceId = $page.params.workspaceId;
                
                await workspaceStore.loadWorkspaces($currentUser.id);
                
                const unsubscribe = workspaceStore.subscribe(state => {
                    currentWorkspace = state.workspaces.find(w => w.id === workspaceId);
                });

                if (currentWorkspace) {
                    workshops = await fetchWorkshops(currentWorkspace.id);
                    workshopStore.loadWorkshops(workshops);
                }

                return () => {
                    unsubscribe();
                };
            } catch (err) {
                error = "Failed to load workspaces or workshops. Please try again later.";
                console.error('Error loading data:', err);
            }
        }
    });

    async function fetchWorkshops(workspaceId: string): Promise<Workshops[]> {
        try {
            const fetchedWorkshops = await getWorkshops(workspaceId);
            return fetchedWorkshops;
        } catch (error) {
            console.error('Error fetching workshops:', error);
            throw error;
        }
    }


    async function createNewWorkshop() {
        if (currentWorkspace) {
            try {
                const newWorkshop: Partial<Workshops> = {
                    name: `New Workshop ${workshops.length + 1}`,
                    description: 'A new workshop',
                    workspace: currentWorkspace.id,
                    workflow: '',
                    prompt: '',
                    replies: [],
                };
                const createdWorkshop = await createWorkshop(newWorkshop);
                workshopStore.addWorkshop(createdWorkshop);
                workshops = [...workshops, createdWorkshop];
            } catch (error) {
                console.error('Error creating new workshop:', error);
            }
        }
    }

    async function handleDeleteWorkshop(workshopId: string) {
        try {
            await deleteWorkshop(workshopId);
            workshopStore.removeWorkshop(workshopId);
            workshops = workshops.filter(w => w.id !== workshopId);
        } catch (error) {
            console.error('Error deleting workshop:', error);
        }
    }

    function startEditing(workshopId: string, event: Event) {
        event.stopPropagation();
        isEditing = { ...isEditing, [workshopId]: true };
    }
    

    async function finishEditing(workshop: Workshops, event: Event) {
        const input = event.target as HTMLInputElement;
        const newName = input.value.trim();
        if (newName && newName !== workshop.name) {
            try {
                const updatedWorkshop = await updateWorkshop(workshop.id, { name: newName });
                workshopStore.updateWorkshop(updatedWorkshop);
                workshops = workshops.map(w => w.id === updatedWorkshop.id ? updatedWorkshop : w);
            } catch (error) {
                console.error('Error updating workshop name:', error);
            }
        }
        isEditing = { ...isEditing, [workshop.id]: false };
    }

    function openWorkshop(workshop: Workshops) {
        activeWorkshop = workshop.id;
        selectedWorkshop = workshop;
    }

    function closeWorkshop() {
        selectedWorkshop = null;
        activeWorkshop = null;
    }

    function goBack() {
        isTransitioningBack = true;
        setTimeout(() => {
            goto('/launcher/');
        }, 1000);
    }

    function handleMouseDown(event: MouseEvent) {
        isDragging = true;
        startX = event.pageX - containerRef.offsetLeft;
        scrollLeft = containerRef.scrollLeft;
        containerRef.style.cursor = 'grabbing';
    }
    function handleMouseUp() {
        isDragging = false;
        containerRef.style.cursor = 'grab';
    }
    function handleMouseMove(event: MouseEvent) {
        if (!isDragging) return;
        const x = event.pageX - containerRef.offsetLeft;
        const walk = (x - startX) * 2;
        containerRef.scrollLeft = scrollLeft - walk;
    }
    function switchTab(tab: 'workshops' | 'agents') {
        activeTab = tab;
    }
</script>
<div class="workspace-layout">
    <div class="tab-row">
        <button class:active={activeTab === 'workshops'} on:click={() => switchTab('workshops')}>
            <Hammer size={20} />
            Workshops
            <span class="workshop-count">{workshopCount}</span>

        </button>
        <button class:active={activeTab === 'agents'} on:click={() => switchTab('agents')}>
            <Bot size={20} />
            Agents
        </button>
    </div>

    {#key activeTab}
        <div 
            class="tab-content"
            in:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
            out:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
        >
            {#if activeTab === 'workshops'}
                <div 
                    class="workshops-container" 
                    class:transitioning-back={isTransitioningBack}
                >
                    <div class="flex-container">
                        <div class="tabs" 
                            bind:this={containerRef}
                            on:mousedown={handleMouseDown}
                            on:mouseup={handleMouseUp}
                            on:mousemove={handleMouseMove}
                            on:mouseleave={handleMouseUp}
                        >                
                            <button class="add-button" on:click={createNewWorkshop}>
                                <Plus size={24} />
                                Add New Workshop
                            </button>
                            {#each workshops as workshop (workshop.id)}
                                <div 
                                    class="workshop-item" 
                                    class:active={activeWorkshop === workshop.id}
                                    on:click={() => openWorkshop(workshop)}
                                    in:slide={{ duration: 300, axis: 'x' }}
                                    out:slide={{ duration: 300, axis: 'x' }}
                                >
                                    {#if isEditing[workshop.id]}
                                        <input
                                            type="text"
                                            value={workshop.name}
                                            on:blur={(e) => finishEditing(workshop, e)}
                                            on:keydown={(e) => e.key === 'Enter' && finishEditing(workshop, e)}
                                        />
                                    {:else}
                                        <div class="workshop-header">
                                            <h3>{workshop.name}</h3>
                                        </div>
                                    {/if}
                                    <div class="workshop-controls" transition:fade={{ duration: 200 }}>
                                        <button class="control-button" on:click={(e) => startEditing(workshop.id, e)}>
                                            <Edit2 size={20} />
                                        </button>
                                        <button class="control-button delete" on:click={(e) => { e.stopPropagation(); handleDeleteWorkshop(workshop.id); }}>
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                            <footer>

                            </footer>
                        </div>
                    </div>
                </div>
            {:else}
                <div class="agents-container">
                    <AgentsList />
                </div>
            {/if}
        </div>
    {/key}
</div>

<div class="content-area">
    {#if selectedWorkshop}
        {#key selectedWorkshop.id}
            <div in:fly={{ y: 300, duration: 300 }} out:fly={{ y: -300, duration: 300 }}>
                <WorkshopOverlay workshop={selectedWorkshop} onClose={closeWorkshop} user={$currentUser} />
            </div>
        {/key}
    {:else}
        <div class="empty-state" in:fade={{ duration: 300 }}>
            <p>Choose a workshop or agent to get started</p>
        </div>
    {/if}
</div>

<slot />

<style>
  .workspace-layout {
        display: flex;
        flex-direction: column;
        position: relative;
        height: auto;
        /* height: 89vh; */
        width: 300px;
        /* top: 130px; */
        left: 0;
        border-radius: 20px;
        justify-content: center;
        align-items: center;
        border: 5px solid #262929;
        transition: all ease-in 0.3s;
    }

    .workspace-layout:hover {
        /* width: 100%; */
        /* height: 100%; */
    }


    .content-area {
        display: flex;
        position: absolute;
        left: 390px; /* Adjust based on your workspace-layout width */
        right: 0;
        bottom: 0;
        overflow: hidden; /* Changed from auto to hidden */
        /* background-color: red; */
    }

    .empty-state {
        display: flex;
        padding: 20px;
        margin-left: 20px;
        justify-content: center;
        align-items: center;
        height: 100%;
        font-size: 24px;
        color: #818380;
    }

    .tab-row {
        display: flex;
        justify-content: center;
        /* padding: 10px; */
        width: 100%;
        background-color: #262929;
        border-bottom: 1px solid #4b4b49;

    }

    .tab-row button {
        display: flex;
        flex-direction: column;
        text-transform: uppercase;
        align-items: center;
        justify-content: center;
        width: 50%;
        gap: 5px;
        padding: 10px 20px;
        background-color: transparent;
        border: none;
        color: #818380;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .tab-row button:hover {
        color: rgb(215, 215, 215);
    }

    .tab-row button.active {
        color: white;
        border-bottom: 2px solid white;
    }

    .workshops-container,
    .agents-container {
        flex: 1;
        overflow-x: hidden;

    }

    .workshop-header {
        display: flex;
        flex-direction: row;
        gap: 10px;
        align-items: center;
        height: 40px;
        /* padding: 10px; */
    }

    .flex-container {
        /* position: absolute; */
        /* bottom: 100px; */
        width: 100%;
        height: 100%;;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
    }
    .flex-container > * {
        /* flex: 1 1 200px; */
    }

    .add-button {
        padding: 14px;
        gap: 10px;
        background-color: #4b4b49;
        width: 100%;
        height: 60px;
        display: flex;
        justify-content: left;
        align-items: center;
        color: white;
        border: none;
        /* border-radius: 14px; */
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        transition: background-color 0.3s, transform 0.3s;
    }

    .add-button:hover {
        background-color: #37b074;
    }

    .workshops-container.transitioning-back {
        transform: scale(0.05);
        opacity: 0;
    }

    .workshops-container.transitioning-back {
        transform: scale(0.05);
        opacity: 0;
    }


    .workshop-item {
        /* padding: 10px 10px; */
    /* background-color: #4b4b49; */
    position: relative;
    color: white;
    border: none;
    border-bottom: 1px solid black;
    /* border-radius: 14px; */
    display: flex;
    /* flex-direction: row; */
    /* flex-grow: calc(1 / 3); */
    /* flex: auto; */
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: left;
    justify-content: center;
    /* margin-bottom: 10px; */
    height: 60px;
    /* gap: 10px; */
    text-align: center;
    font-size: 14px;
    transition: background-color 0.3s, transform 0.3s;
    scroll-snap-align: start;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    user-select: none;
    overflow: hidden;


  }

  .workshop-item:hover {
        background-color: #1e201f;
    }


  .workshop-item.active {
        background-color: #3a3e3c;
    }

  .workspace-button:hover {
    background-color: #f0f0f0;
    /* transform: scale(1.05);  */
  }
  
  .workshop-controls {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: row;
        gap: 10px;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .workshop-item:hover .workshop-controls {
        opacity: 1;
    }


    .control-button {
        padding: 10px 10px;
        background-color: #4b4b49;
        color: white;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        /* height: 50px; */
        width: 40px;
        height: 40px;
        gap: 5px;
        text-align: center;
        font-size: 18px;
        margin-left: 5px;
        transition: background-color 0.3s, transform 0.3s;
        scroll-snap-align: start;
    }

    .tabs {
        /* gap: 10px; */
        /* background-color: blue; */
    }

    .tab-content {
        position: relative;
        width: 100%;
        height: calc(100% - 50px); /* Adjust based on your tab-row height */
        overflow: hidden;
    }

    h3 {
        margin-left: 1rem;
    }
  
    .workshop-count {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    position: absolute;
    right: 50%;
    top: 10px;
    text-align: center;
    justify-content: center;
    align-items: center;
    font-size: 16px;
    font-weight: bold;
  }



  </style>