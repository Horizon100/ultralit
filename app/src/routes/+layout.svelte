Svelte Component with Independent Overlays

<script lang="ts">
import { AppShell } from '@skeletonlabs/skeleton';
import Header from './Header.svelte';
import Footer from './Footer.svelte';
import Messages from "../lib/Messages.svelte";    
import Kanban from "../lib/Kanban.svelte"; 
import Icon from '@iconify/svelte';

import { writable } from 'svelte/store';
import github from '$lib/images/github.svg';

import '../app.css';

const leftOverlayOpen = writable(false);
const leftOverlayPosition = writable(-95);
const rightOverlayOpen = writable(false);
const rightOverlayPosition = writable(300);
let isDragging = false;
let startX = 0;
let startPosition = 0;
let activeOverlay: 'left' | 'right' | null = null;
const activeIcon = writable(0);

function setActiveIcon(index: number) {
    activeIcon.set(index);
    if (!$leftOverlayOpen) {
        toggleLeftOverlay();
    }
}

function toggleLeftOverlay() {
    leftOverlayOpen.update(n => !n);
    leftOverlayPosition.set($leftOverlayOpen ? 0 : -95);
}

function toggleRightOverlay() {
    rightOverlayOpen.update(n => !n);
    rightOverlayPosition.set($rightOverlayOpen ? 0 : 300);
}

function handleDragStart(event: MouseEvent | TouchEvent, side: 'left' | 'right') {
    if (event.target instanceof HTMLElement && event.target.closest('.drag-handle')) {
        isDragging = true;
        activeOverlay = side;
        startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
        startPosition = side === 'left' ? $leftOverlayPosition : $rightOverlayPosition;
        event.preventDefault();
    }
}

function handleDragMove(event: MouseEvent | TouchEvent) {
    if (!isDragging) return;
    const currentX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const diff = currentX - startX;
    let newPosition = startPosition + (activeOverlay === 'left' ? diff : -diff);

    if (activeOverlay === 'left') {
        newPosition = Math.min(Math.max(newPosition, -95), 0);
        leftOverlayPosition.set(newPosition);
    } else {
        newPosition = Math.min(Math.max(newPosition, 0), 300);
        rightOverlayPosition.set(newPosition);
    }
}

function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (activeOverlay === 'left') {
        if ($leftOverlayPosition > -47.5) {
            leftOverlayOpen.set(true);
            leftOverlayPosition.set(0);
        } else {
            leftOverlayOpen.set(false);
            leftOverlayPosition.set(-95);
        }
    } else {
        if ($rightOverlayPosition < 150) {
            rightOverlayOpen.set(true);
            rightOverlayPosition.set(0);
        } else {
            rightOverlayOpen.set(false);
            rightOverlayPosition.set(300);
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
            toggleOverlay={toggleLeftOverlay} 
            toggleRightOverlay={toggleRightOverlay}
            overlayOpen={$leftOverlayOpen}
            rightOverlayOpen={$rightOverlayOpen}
        />
    </svelte:fragment>
    
    <!-- Left Overlay -->
    <div 
        role="dialog"
        aria-label="Left sidebar"
        class="overlay left-overlay bg-surface-200 dark:bg-surface-800 shadow-lg"
        class:open={$leftOverlayOpen}
        style="transform: translateX({$leftOverlayPosition}px)"
        on:mousedown={(e) => handleDragStart(e, 'left')}
        on:touchstart={(e) => handleDragStart(e, 'left')}
    >
        <div class="drag-handle"></div>
        <div class="overlay-content">
            <div class="flex">
                <div class="content-section">
                    {#if $activeIcon === 0}
                        <h1>            
                            Schedule
                        </h1>
                    {:else if $activeIcon === 1}
                        <h1>
                            Kanban
                        </h1>
                        <Kanban />
                    {:else if $activeIcon === 2}
                        <h1>            
                            Values
                        </h1>
                    {:else if $activeIcon === 3}
                        <h1>            
                            Sprints
                        </h1>
                    {/if}
                </div>
                <div class="icon-column">
                    <button on:click={() => setActiveIcon(0)} class:active={$activeIcon === 0}>
                        <Icon icon="mdi:calendar" />
                    </button>
                    <button on:click={() => setActiveIcon(1)} class:active={$activeIcon === 1}>
                        <Icon icon="mdi:view-column" />                    
                    </button>
                    <button on:click={() => setActiveIcon(2)} class:active={$activeIcon === 2}>
                        <Icon icon="mdi:lightbulb-outline" />                    
                    </button>
                    <button on:click={() => setActiveIcon(3)} class:active={$activeIcon === 3}>
                        <Icon icon="mdi:run" />                    
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Right Overlay -->
    <div 
        role="dialog"
        aria-label="Right sidebar"
        class="overlay right-overlay bg-surface-200 dark:bg-surface-800 shadow-lg"
        class:open={$rightOverlayOpen}
        style="transform: translateX({$rightOverlayPosition}px)"
        on:mousedown={(e) => handleDragStart(e, 'right')}
        on:touchstart={(e) => handleDragStart(e, 'right')}
    > 
        <div class="drag-handle"></div>
        <div class="overlay-content">
            <nav class="list-nav p-4">
                <ul>
                    <li><a href="/" class="overlay-link"><h1>Chat</h1></a></li>
                </ul>
                <Messages />
            </nav>
        </div>
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
        z-index: 1004;
        border: solid 2px #30363e;
        display: flex;
        flex-direction: column;
    }

    .left-overlay {
        left: 0;
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
        width: 600px;
        background: linear-gradient(to right, #292929, #333333);
    }

    .right-overlay {
        right: 50px;
        width: 400px;
        border-top-left-radius: 10px;
        border-bottom-left-radius: 10px;
        background: linear-gradient(to left, #292929, #333333);
        box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);
    }
    .overlay-content {
        flex-grow: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }


    .left-overlay .drag-handle {
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
        width: 15px;
        background-color: #1c1c1c;
        position: absolute;
        right: 0;
    }

    .right-overlay .drag-handle {
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
        width: 15px;
        left: 0;
    }

    .drag-handle {
        position: absolute;
        top: 50%;
        height: 300px;
        background-color: #1c1c1c;
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

    h1 {
        margin-bottom: 0;
        margin-top: 0;
        font-size: 24px;
    }

    .icon-column {
        width: 50px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 20px;
        position: absolute;
        right: 0;
        top: 80%;
        justify-content: center;
    }

    .icon-column button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid #1c1c1c;
        background: linear-gradient(to left, #292929, #333333);
        box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.2);        
        color: #ffffff;
        margin-bottom: 20px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .icon-column button:hover,
    .icon-column button.active {
        background-color: #4a4a4a;
    }

    .content-section {
        flex-grow: 1;
        padding: 10px;
        overflow-y: auto;
    }
</style>