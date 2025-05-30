<script lang="ts">
	import { onMount } from 'svelte';
	import { Calendar, ChartAreaIcon, ChartNoAxesGantt, KanbanSquareIcon } from 'lucide-svelte';
	import { writable } from 'svelte/store';
	import { slide, fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
	import Kanban from '$lib/features/tasks/Kanban.svelte';
	import TaskCalendar from '$lib/features/tasks/TaskCalendar.svelte';
	import GantChart from '$lib/components/charts/GantChart.svelte';
	import { projectStore } from '$lib/stores/projectStore';
	import { t } from '$lib/stores/translationStore';
	import Icicle from '$lib/components/charts/Icicle.svelte';
	import { fetchTaskHierarchyData } from '$lib/features/tasks/utils/taskHierarchyData';
	import type { HierarchyData} from '$lib/types/types';
	import { getWallpaperSrc } from '$lib/utils/wallpapers';

	let hierarchyData: HierarchyData = { name: 'Loading tasks...', children: [] };
	let filteredTasks: any[] = [];
	let showTaskList = false;
	let taskListTitle = '';
	let selectedTask: any = null;
	let showTaskModal = false;
	let showPage = false;
	let isLoading = true;
	let authError = false;
	let containerWidth = 1000;
	let containerHeight = 800;
	let currentProjectId: string | null = null;
	let hasProjectAccess = false;
	let projectCollaborators: string[] = [];
	let user = $currentUser;

  const activeTab = writable<string>('kanban');
	const tabTransition = writable<string | null>(null);
		
	function switchTab(tabName: string) {
		tabTransition.set(tabName);
		setTimeout(() => {
			activeTab.set(tabName);
		}, 300);
	}

	projectStore.subscribe((state) => {
		currentProjectId = state.currentProjectId;

		if (currentProjectId && user) {
			const project = state.threads.find((p) => p.id === currentProjectId);

			if (project) {
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
			user = $currentUser;
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
	function handleTaskClick(event: CustomEvent) {
		const { task, name } = event.detail;
		console.log('Task clicked:', name, task);
		selectedTask = task;
		showTaskModal = true;
	}
	function closeTaskModal() {
		showTaskModal = false;
		selectedTask = null;
	}


	async function loadFilteredTasks(status = null, priority = null) {
		try {
			const params = new URLSearchParams();
			if (currentProjectId) params.append('project_id', currentProjectId);
			if (status) params.append('status', status);
			if (priority) params.append('priority', priority);
			
			const response = await fetch(`/api/tasks/filtered?${params}`);
			if (!response.ok) throw new Error('Failed to fetch filtered tasks');
			
			const data = await response.json();
			filteredTasks = data.tasks;
			console.log('Loaded filtered tasks:', filteredTasks.length);
		} catch (error) {
			console.error('Failed to load filtered tasks:', error);
			filteredTasks = [];
		}
	}

	function closeTaskList() {
		showTaskList = false;
		filteredTasks = [];
	}
    function handleOverlayClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('task-modal')) {
            closeTaskModal();
        }
    }
	onMount(async () => {
		initializePage();
		try {
			const data = await fetchTaskHierarchyData('status', currentProjectId ?? undefined);
			hierarchyData = data;
		} catch (error) {
			console.error('Failed to load hierarchy data:', error);
			hierarchyData = { name: 'Failed to load data', children: [] };
		}
	});
</script>

{#if showPage}
	<div in:fade={{ duration: 800 }}>

		<main in:fade={{ duration: 600, delay: 400 }}>
			<!-- Tab Navigation -->
			<div class="tabs" in:slide={{ duration: 400, delay: 600, easing: quintOut }}>
				<button
					class:active={$activeTab === 'kanban'}
					on:click={() => switchTab('kanban')}
					in:fade={{ duration: 400, delay: 850 }}
				>
					<KanbanSquareIcon />
					<span>{$t('tasks.title')}</span>
				</button>
				<button
					class:active={$activeTab === 'task-calendar'}
					on:click={() => switchTab('task-calendar')}
					in:fade={{ duration: 400, delay: 800 }}
				>
					<Calendar />
					<span>{$t('tasks.schedule')}</span>
				</button>
				<button
					class:active={$activeTab === 'gant'}
					on:click={() => switchTab('gant')}
					in:fade={{ duration: 400, delay: 850 }}
				>
					<ChartNoAxesGantt />
					<span>{$t('tasks.gantt')}</span>
				</button>
				<button
					class:active={$activeTab === 'icicle'}
					on:click={() => switchTab('icicle')}
					in:fade={{ duration: 400, delay: 850 }}
				>
					<ChartAreaIcon />
					<span>{$t('tasks.title')}</span>
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

				{#if $activeTab === 'icicle'}
					<div class="tab-panel" in:fade={{ duration: 400 }}>
						<div class="icicle-container" 
							style="z-index: 10;"
							bind:clientWidth={containerWidth} 
							bind:clientHeight={containerHeight}

						>
							<Icicle 
								data={hierarchyData} 
								width={containerWidth} 
								height={containerHeight} 
								scale={1.2} 
								on:taskClicked={handleTaskClick}
							/>
						</div>
					</div>
				{/if}
			</div>
		</main>
	</div>
{/if}


{#if showTaskModal && selectedTask}
	<div class="task-modal" 
		in:fade={{ duration: 300 }} 
		style="z-index: 11;" 
        on:click={handleOverlayClick}
	>
        <div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>{selectedTask.title}</h2>
                <button on:click|stopPropagation={closeTaskModal}>×</button>
			</div>
			<div class="task-details">
				<p><strong>Description:</strong> {selectedTask.description || 'No description'}</p>
				<div class="task-meta">
					<span class="status">Status: {selectedTask.status}</span>
					<span class="priority">Priority: {selectedTask.priority}</span>
					{#if selectedTask.assignedTo}
						<span class="assigned">Assigned to: {selectedTask.assignedTo}</span>
					{/if}
					{#if selectedTask.due_date}
						<span class="due-date">Due: {new Date(selectedTask.due_date).toLocaleDateString()}</span>
					{/if}
					{#if selectedTask.start_date}
						<span class="start-date">Start: {new Date(selectedTask.start_date).toLocaleDateString()}</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
<!-- Task List Modal -->
{#if showTaskList}
	<div class="task-list-modal" 
		in:fade={{ duration: 300 }}
	
	>
		<div class="modal-content">
			<div class="modal-header">
				<h2>{taskListTitle}</h2>
				<button on:click={closeTaskList}>×</button>
			</div>
			<div class="task-list">
				{#each filteredTasks as task}
					<div class="task-item">
						<h3>{task.title}</h3>
						<p>{task.taskDescription || 'No description'}</p>
						<div class="task-meta">
							<span class="status">Status: {task.status}</span>
							<span class="priority">Priority: {task.priority || 'medium'}</span>
							{#if task.due_date}
								<span class="due-date">Due: {new Date(task.due_date).toLocaleDateString()}</span>
							{/if}
						</div>
					</div>
				{/each}
				{#if filteredTasks.length === 0}
					<p>No tasks found for this selection.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;

	* {
		font-family: var(--font-family);
	}
	main {
		flex-grow: 1;
		left: 0;
		position: absolute;
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
		overflow-y: hidden;
	}

	.icicle-container {
		width: 100vw; /* Full viewport width */
		height: 100vh; /* Full viewport height */
		margin-top: 3rem;
		margin-left: 3rem;
		/* Or use percentages: */
		/* width: 90%; */
		/* height: 70vh; */
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 1rem;
		width: 100%;
	}
	span {
		&.status,
		&.priority, 
		&.due-date {
			color: var(--text-color) !important;
			background: var(--primary-color) !important;
		}
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
		right: 0;
		top: 0.5rem;
		bottom: 0;
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
		width: 100%;
		height: auto;
		left: 0%;
		top: 60%;
		transform: translateY(-50%);
		opacity: 0.025;
		// z-index: 1;
		pointer-events: none;
		backdrop-filter: blur(20px);
	}
    .task-modal {
        position: absolute;
        top: 0;
        left: auto;
        right: 0;
        bottom: 0;
        display: flex;
		backdrop-filter: blur(10px);
		border-left: 1px solid var(--line-color);
        justify-content: center;
        align-items: flex-start;
		height: 100vh;
        z-index: 1000;
        
        .modal-content {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-items: flex-end;
            padding: 20px;
            border-radius: 8px;
            max-width: 800px;
			min-width: 450px;
            width: 100%;
            height: 100%;
            overflow-y: auto;

			flex: 1;
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
				width: 100%;
                
                h2 {
                    margin: 0;
                }
                
                button {
                    background: none;
                    border: none;
                    font-size: 24px;
					color: var(--placeholder-color);
                    cursor: pointer;
                }
            }
            
            .task-details {
                p {
                    margin-bottom: 15px;
                }
                
                .task-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    font-size: 14px;
                    
                    span {
                        padding: 4px 8px;
                        border-radius: 4px;
                        background: #f0f0f0;
                    }
                }
            }
        }
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
