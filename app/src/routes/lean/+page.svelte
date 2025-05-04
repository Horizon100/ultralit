<script lang="ts">
  import { onMount } from 'svelte';
  import Kanban from '$lib/components/lean/Kanban.svelte';
  import { Calendar, ChartNoAxesGantt, KanbanSquareIcon } from 'lucide-svelte';
  import { writable } from 'svelte/store';
  import { slide, fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentUser } from '$lib/pocketbase';
  import TaskCalendar from '$lib/components/features/TaskCalendar.svelte';
  import GantChart from '$lib/components/features/GantChart.svelte';
  import Headmaster from '$lib/assets/illustrations/headmaster2.png';

  let showPage = false;
  const activeTab = writable('kanban');
  
  // Store for tracking which tab is transitioning
  const tabTransition = writable(null);

  $: user = $currentUser;

  onMount(() => {
      user = $currentUser;
      // Short delay to ensure DOM is ready
      setTimeout(() => {
          showPage = true;
      }, 50);
  });
  
  // Function to handle tab switching with transitions
  function switchTab(tabName) {
      // Set the transitioning tab
      tabTransition.set(tabName);
      
      // After a short delay for the out transition, change the active tab
      setTimeout(() => {
          activeTab.set(tabName);
      }, 300);
  }
</script>

{#if showPage}
<div in:fade={{ duration: 800 }}>
  <img src={Headmaster} alt="Notes illustration" class="illustration" in:fade={{ duration: 1000, delay: 200 }} />

  <main in:fade={{ duration: 600, delay: 400 }}>
      <!-- Tab Navigation -->
      <div class="tabs" in:slide={{ duration: 400, delay: 600, easing: quintOut }}>
          <button
              class:active={$activeTab === 'task-calendar'}
              on:click={() => switchTab('task-calendar')}
              in:fade={{ duration: 400, delay: 800 }}
          >
              <Calendar/>
              Calendar
          </button>
          <button
              class:active={$activeTab === 'kanban'}
              on:click={() => switchTab('kanban')}
              in:fade={{ duration: 400, delay: 850 }}
          >
              <KanbanSquareIcon/>
              Kanban Board
          </button>
          <button
            class:active={$activeTab === 'gant'}
            on:click={() => switchTab('gant')}
            in:fade={{ duration: 400, delay: 850 }}
        >
            <ChartNoAxesGantt/>
            Gant Chart
        </button>
      </div>
    
      <!-- Tab Panels -->
      <div class="tab-panels">
          {#if $activeTab === 'kanban'}
              <div class="tab-panel" in:fade={{ duration: 400 }}>
                  <Kanban />
              </div>
          {/if}
          
          {#if $activeTab === 'task-calendar'}
              <div class="tab-panel" in:fade={{ duration: 400 }}>
                  <TaskCalendar />
              </div>
          {/if}
          {#if $activeTab === 'gant'}
          <div class="tab-panel" in:fade={{ duration: 400 }}>
              <GantChart />
          </div>
      {/if}
      </div>
  </main>
</div>
{/if}
  
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
    overflow-x: hidden;
    overflow-y: hidden;
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
      justify-content: center;
    }
  
    .tabs button {
      padding: 0.5rem 1rem;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1.3rem;
      color: #666;
      transition: color 0.3s, border-bottom 0.3s;
      display: flex;
      justify-content: center;
      width: auto;
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
		height: auto;
		display: flex;
		flex-direction: column;
    overflow-y: none;
	}
}
  </style>