<script lang="ts">
    import { onMount } from 'svelte';
    import Kanban from '$lib/components/lean/Kanban.svelte';
	import { KanbanIcon, KanbanSquareDashed, KanbanSquareIcon, Lightbulb, MapIcon, MapPinCheck, MapPinned, Minimize, UserRoundSearch } from 'lucide-svelte';
    import { writable } from 'svelte/store';
    import {slide, fly, fade } from 'svelte/transition'
	import { quintOut } from 'svelte/easing';
    import {  } from '$lib/pocketbase';
	import { currentUser } from '$lib/pocketbase';
    
	let showFade = false;
	let showH2 = false;
    const activeTab = writable('kanban');

	$: user = $currentUser;

    onMount(() => {
		user = $currentUser;
		setTimeout(() => (showFade = true), 50);
		setTimeout(() => (showH2 = true), 50);
	});
  </script>
  
  <main in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}>
    <h1>Lean Workspace</h1>
  
    <!-- Tab Navigation -->
    <div class="tabs" transition:slide={{ duration: 300, easing: quintOut }}>
        <button
            class:active={$activeTab === 'Lean Canvas'}
            on:click={() => activeTab.set('Lean Canvas')}
            in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}
            >
            <Lightbulb/>
            Lean Canvas
        </button>
        <button
            class:active={$activeTab === 'MVP'}
            on:click={() => activeTab.set('MVP')}
            >
            <Minimize/>
            MVP
        </button>
        <button
            class:active={$activeTab === 'user-journey'}
            on:click={() => activeTab.set('user-journey')}
            >
            <MapIcon/>
            User Journey
        </button>
        <button
            class:active={$activeTab === 'story-map'}
            on:click={() => activeTab.set('story-map')}
            >
            <MapPinned/>
            Story Map
        </button>
        <button
            class:active={$activeTab === 'kanban'}
            on:click={() => activeTab.set('kanban')}
        >
        <KanbanSquareIcon/>
            Kanban Board
        </button>

    </div>
  
    <!-- Tab Panels -->
    <div class="tab-panels">
      {#if $activeTab === 'kanban'}
        <div class="tab-panel">
          <Kanban />
        </div>
      {/if}
  
      {#if $activeTab === 'user-journey'}
        <div class="tab-panel">
          <p>This is the User Journey tab. Add your user journey map or related content here.</p>
        </div>
      {/if}
      {#if $activeTab === 'MVP'}
      <div class="tab-panel">
        <p>This is the User Journey tab. Add your user journey map or related content here.</p>
      </div>
    {/if}
    </div>
  </main>
  
<style lang="scss">

	@use "src/styles/themes.scss" as *;

	main {
		flex-grow: 1;
		overflow-y: auto;
		padding: 20px;
        position: absolute;
		align-items: center;
		margin-left: auto;
		margin-right: auto;
		width: auto;
		left: 4rem;
		right: 0.5rem;
		height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--primary-color);
		border-radius: 40px;
	}
  
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      width: 100%;
    }
  
    .tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      width: 100%;
    }
  
    .tabs button {
      padding: 0.5rem 1rem;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1rem;
      color: #666;
      transition: color 0.3s, border-bottom 0.3s;
      display: flex;
      justify-content: center;
      width: 170px;
      align-items: center;
      gap: 0.5rem;
      transition: all ease-in-out 0.3s;

      &:hover {
        border-bottom: 2px solid var(--secondary-color);

        // background: var(--secondary-color);
      }
    }
  
    .tabs button.active {
        border-bottom: 2px solid var(--tertiary-color);
      color: var(--text-color);
    }
  
    .tab-panels {
      margin-top: 1rem;
      width: 100%;
      height: auto;
    }
  
    .tab-panel {
      padding: 1rem;
      border: 1px solid var(--secondary-color);
      border-radius: var(--radius-m);
      background: var(--bg-gradient-r);

      height: 80vh;

    }
  
    p {
      font-size: 1.2rem;
      color: #666;
    }
  </style>