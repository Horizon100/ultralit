<script lang="ts">
	import { onMount } from 'svelte';
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
	import type { HierarchyData, AIModel, InternalChatMessage } from '$lib/types/types';
	import { getWallpaperSrc } from '$lib/utils/wallpapers';
	import {
		sidenavStore,
		showSidenav,
		showInput,
		showRightSidenav,
		showEditor,
		showOverlay
	} from '$lib/stores/sidenavStore';
	import type { Task } from '$lib/types/types';
	import NoteEditor from '$lib/features/notes/components/NoteEditor.svelte';
	import { clientTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import AIChat from '$lib/features/ai/components/chat/AIChat.svelte';
	import { toast } from '$lib/utils/toastUtils';
	import Toast from '$lib/components/modals/Toast.svelte';
	import { defaultModel } from '$lib/features/ai/utils/models';

	let hierarchyData: HierarchyData = { name: 'Loading tasks...', children: [] };
	let filteredTasks: Task[] = [];
	let showTaskList = false;
	let taskListTitle = '';
	let selectedTask: Task | null = null;
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
	let addTagInput: HTMLInputElement;
	let userId: string = '';
	let threadId: string | null = null;
	let messageId: string | null = null;

	const activeTab = writable<string>('kanban');
	const tabTransition = writable<string | null>(null);


let aiModel = defaultModel;

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
			// Wait for authentication first
			const authenticated = await ensureAuthenticated();
			if (!authenticated) {
				authError = true;
				isLoading = false;
				return;
			}

			user = $currentUser;
			if (!user) {
				authError = true;
				isLoading = false;
				return;
			}

			userId = user.id;

			// Small delay to ensure everything is properly set
			setTimeout(() => {
				showPage = true;
				isLoading = false;
			}, 50);
		} catch (error) {
			console.error('Authentication error:', error);
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

	function closeTaskList() {
		showTaskList = false;
		filteredTasks = [];
	}
	function handleOverlayClick(event: MouseEvent): void {
		if ((event.target as HTMLElement).classList.contains('task-modal')) {
			closeTaskModal();
		}
	}
	$: if ($currentUser && !userId) {
		userId = $currentUser.id;
		user = $currentUser;
	}
	$: defaultMessage = {
		id: '',
		text: '',
		content: '',
		user: userId,
		role: 'user' as const,
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: 'messages',
		parent_msg: null,
		provider: 'openai' as const,
		prompt_type: null,
		prompt_input: null,
		model: aiModel.id,
		thread: threadId || undefined,
		isTyping: false,
		isHighlighted: false,
		reactions: {
			upvote: 0,
			downvote: 0,
			bookmark: [],
			highlight: [],
			question: 0
		}
	} as InternalChatMessage;
	onMount(async () => {
		initializePage();

		console.log('Starting hierarchy data fetch...');

		const hierarchyResult = await clientTryCatch(
			fetchTaskHierarchyData('status', currentProjectId ?? undefined),
			'Failed to load hierarchy data.'
		);

		console.log('Hierarchy result:', hierarchyResult);

		if (isSuccess(hierarchyResult)) {
			// Check if the data indicates an error
			if (hierarchyResult.data.name === 'No status data available') {
				console.log('Data indicates error - showing toast');
				toast.error('Failed to load hierarchy data. Please login in.');
				hierarchyData = hierarchyResult.data;
			} else {
				console.log('Success - setting data');
				hierarchyData = hierarchyResult.data;
			}
		} else {
			console.log('Failure - showing toast and setting fallback');
			toast.error('Failed to load hierarchy data.');
			hierarchyData = { name: 'No data available', children: [] };
		}
	});
</script>

{#if showPage}
	<div in:fade={{ duration: 800 }}>
		<main in:fade={{ duration: 600, delay: 400 }}>
			<!-- Tab Navigation -->
			<!-- <div class="tabs" in:slide={{ duration: 400, delay: 600, easing: quintOut }}> -->
			<!-- <button
					class:active={$activeTab === 'kanban'}
					on:click={() => switchTab('kanban')}
					in:fade={{ duration: 400, delay: 850 }}
				>
					<KanbanSquareIcon />
					<span>{$t('tasks.title')}</span>
				</button> -->
			<!-- <button
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
			</div> -->
			<div class="row-wrapper">
				<div class="kanban-wrapper">
					<Kanban />
				</div>

				<!-- {#if $showEditor}
					<div class="notes-wrapper">
						<NoteEditor />
					</div>
				{:else}{/if} -->

				<!-- {#if $showOverlay && user && !authError}
					<div class="chat" in:fly={{ y: 200, duration: 400 }} out:fade={{ duration: 300 }}>
						<AIChat
							message={defaultMessage}
							{threadId}
							initialMessageId={messageId}
							{aiModel}
							{userId}
						/>
					</div>
				{:else if authError}
					<div class="auth-error">
						<p>Authentication failed. Please refresh the page.</p>
						<button on:click={() => window.location.reload()}>Refresh</button>
					</div>
				{/if} -->
			</div>

			<!-- Tab Panels -->
			<div class="tab-panels">
				{#if $activeTab === 'kanban'}
					<div class="tab-panel" in:fade={{ duration: 400 }}></div>
				{/if}

				{#if $activeTab === 'task-calendar'}
					<div class="tab-panel" in:fade={{ duration: 400 }}></div>
				{/if}
				{#if $activeTab === 'gant'}
					<div class="tab-panel" in:fade={{ duration: 400 }}>
						<GantChart />
					</div>
				{/if}

				{#if $activeTab === 'icicle'}
					<div class="tab-panel" in:fade={{ duration: 400 }}>
						<div
							class="icicle-container"
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
<Toast />

{#if showTaskModal && selectedTask}
	<div
		class="task-modal"
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
						<span class="due-date">Due: {new Date(selectedTask.due_date).toLocaleDateString()}</span
						>
					{/if}
					{#if selectedTask.start_date}
						<span class="start-date"
							>Start: {new Date(selectedTask.start_date).toLocaleDateString()}</span
						>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
<!-- Task List Modal -->
{#if showTaskList}
	<div class="task-list-modal" in:fade={{ duration: 300 }}>
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
	@use 'src/lib/styles/themes.scss' as *;

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
	.row-wrapper {
		display: flex;
		flex-direction: row;
		position: relative;
		width: 100%;
	}
	.kanban-wrapper {
		display: flex;
		flex-direction: row;
		overflow: none;
		width: auto;
	}
	.calendar-wrapper {
		display: flex;
		flex-direction: column;
		z-index: 10000;
		backdrop-filter: blur(3px);
		width: auto;
		max-width: 700px;
		border-radius: 2rem;
		justify-content: center;
		align-items: center;
		height: auto;
		position: absolute;
		top: auto;
		bottom: 4rem;
		left: 450px;
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
	}
	.notes-wrapper {
		display: flex;
		flex-direction: row;
		z-index: 6500;
		backdrop-filter: blur(3px);
		width: auto;
		height: auto;
		position: absolute;
		top: 0;
		bottom: 0;
		right: 600px;
		left: 450px;
		box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
	}
	.chat {
		width: 100% !important;
		max-width: 1200px ;

		display: flex;
		right: 0.5rem;
		top: 0;
		z-index: 9999;
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
		position: relative;
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
		.kanban-wrapper {
			display: flex;
			flex-direction: column-reverse;
			overflow: none;
			width: auto;
			bottom: 10rem !important;
		}
		.row-wrapper {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			position: relative;
			height: 100%;
		}
		.notes-wrapper {
			display: flex;
			flex-direction: row;
			z-index: 6500;
			backdrop-filter: blur(10px);
			width: auto;
			height: auto;
			position: absolute;
			right: 0;
			left: 0;
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
		}
		.calendar-wrapper {
			display: flex;
			flex-direction: column;
			z-index: 6500;
			backdrop-filter: blur(3px);
			width: 100% !important;
			height: auto;
			max-width: 1000px;
			bottom: 0;
			margin-left: auto;
			width: 1000px;
			position: relative;
			box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
			transform: translateY(-100%);
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
