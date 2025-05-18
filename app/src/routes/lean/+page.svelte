<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar, ChartNoAxesGantt, KanbanSquareIcon } from 'lucide-svelte';
  import { writable } from 'svelte/store';
  import { slide, fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
  import Kanban from '$lib/components/lean/Kanban.svelte';
  import TaskCalendar from '$lib/components/features/TaskCalendar.svelte';
  import GantChart from '$lib/components/features/GantChart.svelte';
  import Headmaster from '$lib/assets/illustrations/headmaster2.png';
  import { projectStore } from '$lib/stores/projectStore';

  let showPage = false;
  let isLoading = true;
  let authError = false;

  let currentProjectId: string | null = null;
  let hasProjectAccess = false;
  let projectCollaborators: string[] = [];
  let user = $currentUser;
  
  const activeTab = writable('kanban');
  
  const tabTransition = writable(null);

  function switchTab(tabName) {
      tabTransition.set(tabName);
      
      setTimeout(() => {
          activeTab.set(tabName);
      }, 300);
  }

  projectStore.subscribe(state => {
    currentProjectId = state.currentProjectId;
    
    if (currentProjectId && user) {
      const project = state.threads.find(p => p.id === currentProjectId);
      
      if (project) {
        // User has access if they are the owner or a collaborator
        const isOwner = project.owner === user.id;
        const isCollaborator = project.collaborators?.includes(user.id) || false;
        hasProjectAccess = isOwner || isCollaborator;
        projectCollaborators = project.collaborators || [];
      } else {
        hasProjectAccess = false;
        projectCollaborators = [];
      }
    } else {
      hasProjectAccess = false;
      projectCollaborators = [];
    }
  });
  async function initializePage() {
    isLoading = true;
    authError = false;
    
    try {
      // Ensure user is authenticated
      // const isAuthenticated = await ensureAuthenticated();
      
      // if (!isAuthenticated) {
      //   console.error('Authentication failed');
      //   authError = true;
      //   isLoading = false;
      //   return;
      // }
      
      // Update user variable with the authenticated user
      user = $currentUser;
      
      // Short delay to ensure DOM is ready
      setTimeout(() => {
        showPage = true;
        isLoading = false;
      }, 50);
    } catch (error) {
      console.error('Error during initialization:', error);
      authError = true;
      isLoading = false;
    }
  }
  onMount(() => {
    initializePage();
  });

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
              <span>
                Schedule
              </span>
          </button>
          <button
              class:active={$activeTab === 'kanban'}
              on:click={() => switchTab('kanban')}
              in:fade={{ duration: 400, delay: 850 }}
          >
              <KanbanSquareIcon/>
              <span>
                Tasks
              </span>
          </button>
          <button
            class:active={$activeTab === 'gant'}
            on:click={() => switchTab('gant')}
            in:fade={{ duration: 400, delay: 850 }}
        >
            <ChartNoAxesGantt/>
            <span>
              Taskflows
            </span>
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
    left: 1rem;
        position: absolute;
		width: 100%;
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
      justify-content: flex-start;
      align-items: center;
      gap: 1rem;
      margin-top: 0.5rem;
      margin-bottom: 0;
      width: auto;
      max-width: 300px;
      margin-left: 0;
      user-select: none;
      z-index: 1000;
    }
  
    .tabs button {
      // padding: 0.5rem;
      height: 2rem;
      border: none;
      border-radius: 0.5rem;
      background: none;
      cursor: pointer;
      font-size: 1rem;
      color: var(--placeholder-color);
      display: flex;
      justify-content: center;
      width: auto;
      align-items: center;
      gap: 0.5rem;
      transition: all ease-in-out 0.1s;
      & span {
        display: none;
        transition: all ease-in-out 0.1s;

      }

      &:hover {
        background: var(--line-color);
        & span {
          display: flex;
        }
        // background: var(--secondary-color);
      }
    }
  
    .tabs button.active {
        // border-bottom: 1px solid var(--tertiary-color);
        color: var(--text-color);
        background: var(--secondary-color);
        & span {
          display: flex;
        }
    }
  
    .tab-panels {
      margin-top: 0;
      display: flex;
      position: absolute;
      left: 0;
      right: 1rem;
      top: 0.5rem;
      bottom: 1rem;
      justify-content: center;
      height: auto;
    }
  
    .tab-panel {
      // border: 1px solid var(--secondary-color);
      border-radius: var(--radius-m);
      // background: var(--bg-gradient-r);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      // max-width: 1600px;
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
    padding: 0;
        position: absolute;
		margin-left: 0 !important;
    margin-top: 0.5rem;
		width: 100%;
		height: 95vh;
		display: flex;
		flex-direction: column;
    overflow-y: none;
	}
  .tab-panels {
      right: 0.5rem;
      left: 0.5rem;
    }
  
  .tabs {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 1rem;
      height: 2rem;
      margin-top: 0.5rem;
      margin-bottom: 0;
      width: calc(50% - 10rem);
      user-select: none;
      z-index: 1000;
    }
  
    .tabs button {
      // padding: 0.5rem;
      height: 2rem;

      & span {
        display: none;
        transition: all ease-in-out 0.1s;

      }

      &:hover {
        background: var(--line-color);
        & span {
          display: flex;
        }
        // background: var(--secondary-color);
      }
    }
  
    .tabs button.active {
        // border-bottom: 1px solid var(--tertiary-color);
        color: var(--text-color);
        background: var(--secondary-color);
        & span {
          display: flex;
        }
    }
}
@media (max-width: 768px) {
  .tab-panels {
    margin-top: 3rem;
    left: 0;
    right: 0;
  }
}
@media (max-width: 450px) {

  .tabs {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 0.5rem;
      height: 3rem;
      margin-top: 0;
      margin-bottom: 0;
      width: auto;
      margin-left: auto;
      user-select: none;
      z-index: 1000;
    }
    .tabs button {
      &:hover {
        & span {
          display: none;
        }
      }
    }
  main {
    margin-right: 0;
    margin-left: 0;
    margin-top: 0;
    left: 0;
    width: 100%;
    height: 92vh;
  }


}
  </style>