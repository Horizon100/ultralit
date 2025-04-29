<script lang="ts">
    import { onMount } from 'svelte';
    import Kanban from '$lib/components/lean/Kanban.svelte';
	import { Calendar, KanbanIcon, KanbanSquareDashed, KanbanSquareIcon, Lightbulb, MapIcon, MapPinCheck, MapPinned, Minimize, UserRoundSearch } from 'lucide-svelte';
    import { writable } from 'svelte/store';
    import {slide, fly, fade } from 'svelte/transition'
	import { quintOut } from 'svelte/easing';
    import {  } from '$lib/pocketbase';
	import { currentUser } from '$lib/pocketbase';
    import TaskCalendar from '$lib/components/features/TaskCalendar.svelte';
    import Headmaster from '$lib/assets/illustrations/headmaster2.png';

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
    <img src={Headmaster} alt="Notes illustration" class="illustration" />

  <main in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}>
  
    <!-- Tab Navigation -->
    <div class="tabs" transition:slide={{ duration: 300, easing: quintOut }}>
        <button
            class:active={$activeTab === 'task-calendar'}
            on:click={() => activeTab.set('task-calendar')}
            in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}

            >
            <Calendar/>
            Calendar
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
      {#if $activeTab === 'task-calendar'}
      <div class="tab-panel">
        <TaskCalendar />
      </div>
    {/if}


    </div>
  </main>
  
<style lang="scss">

	@use "src/styles/themes.scss" as *;

	main {
		flex-grow: 1;
    left: 3rem;
    padding: 1rem;
        position: absolute;
		margin-left: 0 !important;
		width: calc(100% - 4rem);
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
  
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      width: 100%;
    }
  
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0;
      width: 100%;
      user-select: none;
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
      display: flex;
      justify-content: center;
      height: auto;
    }
  
    .tab-panel {
      // border: 1px solid var(--secondary-color);
      border-radius: var(--radius-m);
      // background: var(--bg-gradient-r);
      height: 80vh;
      max-width: 1600px;
      width: 100%;
    }
  
    p {
      font-size: 1.2rem;
      color: #666;
    }
  //   .illustration {
	// 	position: absolute;
	// 	width: 95%;
	// 	height: auto;
	// 	left: 5%;
	// 	top: 50%;
	// 	transform: translateY(-50%);
	// 	opacity: 0.015;
	// 	z-index: 0;
	// 	pointer-events: none;
	// }
  .illustration {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width:100%;
    height: auto;
    left: 0%;
    top: 60%;
    transform: translateY(-50%);
    opacity: 0.025;
    // z-index: 1;
    pointer-events: none;
    backdrop-filter: blur(20px);
  }

  @media (max-width: 1000px) {

	main {
		flex-grow: 1;
    left: 0;
    padding: 1rem;
        position: absolute;
		margin-left: 0 !important;
    margin-top: 1rem;
		width: calc(100% - 2rem);
		height: 100vh;
		display: flex;
		flex-direction: column;
	}
}
  </style>