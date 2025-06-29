<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { showThreadList } from '$lib/stores/threadsStore';
	import { isTextareaFocused } from '$lib/stores/textareaFocusStore';
	import { projectStore } from '$lib/stores/projectStore';
	import { t } from '$lib/stores/translationStore';
	import ProjectCard from '$lib/components/cards/ProjectCard.svelte';
	import { UIUtils } from '$lib/utils/uiUtils';
	import type { Threads } from '$lib/types/types';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// Props
	export let currentThread: Threads | null = null;
	export let userId: string;
	export let name: string = 'You';
	export let isUpdatingThreadName = false;
	export let isEditingThreadName = false;
	export let editedThreadName = '';
	export let isMinimized = false;
	export let promptSuggestions: string[] = [];

	const dispatch = createEventDispatcher();

	function startEditingThreadName() {
		if (!currentThread) return;
		const isOwner = currentThread.user === userId || currentThread.op === userId;
		if (!isOwner) return;
		dispatch('startEditing', { threadName: currentThread.name || '' });
	}

	function handlePromptSelection(promptText: string) {
		dispatch('promptSelected', { promptText });
	}

	async function handleSendMessage(message: string): Promise<void> {
		dispatch('sendMessage', { message });
	}

	function getRandomGreeting(): string {
		return UIUtils.getRandomGreeting();
	}

	function getRandomQuestions(): string {
		return UIUtils.getRandomQuestions();
	}
</script>

<div
	class="chat-header"
	class:minimized={isMinimized}
	transition:slide={{ duration: 300, easing: cubicOut }}
>
	{#if currentThread}
		<div class="chat-header-thread">
			{#if currentThread && (currentThread.user === userId || currentThread.op === userId)}
				{#if isUpdatingThreadName}
					<div class="spinner-container">
						<div class="spinner"></div>
					</div>
				{:else}
					<span on:click={startEditingThreadName}>
						<div class="icon" in:fade>
							<!-- Optional icon -->
						</div>
						<h3>
							{currentThread?.name || '(untitled)'}
						</h3>
					</span>
				{/if}
			{:else}
				<!-- Read-only thread name for non-owners -->
				<h3>
					{currentThread?.name || '(untitled)'}
				</h3>
			{/if}
		</div>
	{:else}
		<!-- Placeholder content when no thread is selected -->
		<div class="chat-placeholder" class:drawer-visible={$showThreadList}>
			<div class="container-row">
				<div class="dashboard-scroll" class:drawer-visible={$showThreadList}>
					{#if $projectStore.currentProjectId}
						<ProjectCard projectId={$projectStore.currentProjectId} {handleSendMessage} />
					{:else if $isTextareaFocused}
						<!-- Hide greeting when textarea is focused -->
					{:else}
						<span class="start" in:slide={{ duration: 200 }} out:slide={{ duration: 200 }}>
							<h3 in:slide={{ duration: 200 }} out:slide={{ duration: 200 }}>
								{getRandomGreeting()}
								{name},
							</h3>
							<p>
								{getRandomQuestions()}
							</p>
						</span>

						{#if promptSuggestions.length > 0}
							<span class="prompts">
								{#each promptSuggestions as prompt}
									<span
										class="prompt"
										on:click={() => handlePromptSelection(prompt)}
										on:keydown={(e) => e.key === 'Enter' && handlePromptSelection(prompt)}
										role="button"
										tabindex="0"
									>
										{prompt}
									</span>
								{/each}
							</span>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	:root {
		--h3-min-size: 0.875rem;
		--h3-max-size: 1.125rem;
		--breakpoint-sm: #{$breakpoint-sm};
		--breakpoint-md: #{$breakpoint-md};
		--breakpoint-lg: #{$breakpoint-lg};
		--breakpoint-xl: #{$breakpoint-xl};
	}
	.slot-wrapper {
		width: 100%;
		max-width: 1200px;
		margin: 1rem 0;
		z-index: 9999;
	}
	.container-row {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		margin-bottom: 11rem !important;
		position: relative;
		justify-content: space-between;
		align-items: center;
		// justify-content:space-between;
		transition: all 0.3s ease;
		gap: auto;
	}
	span {
		display: flex;
		justify-content: left;
		align-items: center;
		color: var(--text-color);

		&.btn {
			display: flex;
			width: auto;
			border-radius: 50%;
			padding: 0.5rem;
			width: 2rem;
			height: 2rem;
			transition: all 0.3s ease;
			border: none;

			&:hover {
				cursor: pointer;
				transform: scale(1.3);
				background: var(--bg-gradient-left);
			}
		}

		&.start {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			height: auto !important;
			width: auto;
			margin-bottom: 0 !important;
			max-width: 800px;
			gap: 0.5rem;
			margin: 0;

			position: relative;
			transition: all 0.3s ease;
			& p {
				font-size: 1.5rem;
			}
			&:hover {
				animation: shake 2.8s ease;
			}
			& h3 {
				font-size: 2rem;
				display: flex;
				width: auto;
				max-width: 800px;
				justify-content: center !important;
				align-items: center !important;
				padding: 0 !important;
			}

			& img.logo {
				width: 3rem;
				height: 3rem;

				margin-top: auto;
				display: flex;
				justify-content: center;
				align-items: center;
			}
		}

		&.icon {
			transition: all 0.2s ease-in-out;
			gap: 0.5rem;
			height: 36px;

			& &.active {
				color: var(--bg-color) !important;
			}
		}
		&.counter {
			color: var(--placeholder-color);
			font-size: 16px;
			max-width: 100px;
			margin: 0 !important;
			display: flex;
			flex-direction: row;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&.role {
			display: flex;
			justify-content: center;
			align-items: center;
		}
		&.model {
			display: flex;
			box-shadow: rgba(128, 128, 128, 0.8);
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			border-radius: 1rem;
		}
	}

	.chat-header {
		height: 3rem;
		margin-left: 0;
		// margin-bottom: 160px;
		position: relative;
		// border-top-left-radius: var(--radius-m);
		// border-top-right-radius: var(--radius-m);
		top: 0rem;
		left: 0rem;
		right: 0;
		width: 100%;
		z-index: 2000;
		// padding: 0.5rem;
		color: var(--text-color);
		text-align: left;
		transition: background-color 0.2s;
		background: rgba(0, 0, 0, 0.002);
		// border-radius: var(--radius-m);
		display: flex;
		// gap: 2rem;
		flex-direction: row;
		transition: all 0.2s ease;
		// border-bottom: 1px solid var(--line-color);
		background: linear-gradient(
			to top,
			transparent 0%,
			rgba(255, 255, 255, 0.05) 90%,
			rgba(255, 255, 255, 0.05) 40%
		);
		backdrop-filter: blur(2px) !important;
		& h3 {
			margin: 0;
			margin-top: auto;
			font-size: 1rem !important;
			text-align: left;
			font-weight: 600;
			&.active {
				// background: var(--primary-color) !important;
				color: var(--tertiary-color);
				font-size: var(--font-size-m);
			}

			&:hover {
				background: rgba(255, 255, 255, 0.1);
			}
		}

		.chat-header-thread {
			width: 100%;
			gap: auto;
			height: 3rem;
			padding: 0;
			font-size: 1.3rem;
			// border-bottom: 1px solid var(--placeholder-color);
			display: flex;
			align-items: center;
			justify-content: center;
			margin-left: auto;
			letter-spacing: 0.2rem;
			user-select: none;
			& .icon {
				color: var(--placeholder-color);
				margin-right: 0.5rem;
				display: flex;
				height: auto;
				width: auto;
			}

			& span {
				gap: 0.5rem;
			}
			h3 {
				// font-style: italic;
				letter-spacing: 0.25rem;
				font-size: calc(0.5rem + 1vmin);
				font-weight: 200;
				color: var(--tertiary-color);
			}
		}
		.drawer-tab {
			display: flex;
			align-items: center;
			justify-content: space-between;

			width: auto !important;
			padding: 0 1rem;
			position: relative;
			// padding: 0.5rem 1rem;
			height: 100%;
			border: none;
			border-radius: 2rem;
			background: var(--secondary-color);
			color: var(--placeholder-color);
			cursor: pointer;
			transition: all 0.2s ease-in-out;
		}

		&.active {
			background: var(--primary-color) !important;
			color: var(--tertiary-color);
			font-size: var(--font-size-s);
			width: fit-content;
			flex: 1;
			justify-content: center;
		}
	}
	.chat-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		border-radius: var(--radius-m);
		// background: var(--primary-color);
		transition: all 0.3s ease;
		margin-left: 1rem;
		margin-right: 1rem;

		margin-top: 0;
		height: calc(100vh - 20rem);
		user-select: none;
		scrollbar-width: thin;
		scrollbar-color: var(--secondary-color) transparent;
		scroll-behavior: smooth;
		width: 100%;
		z-index: 0;

		& h3 {
			font-size: 50px;
			user-select: none;

			&:hover {
				// transform: scale(1.1);
				// animation: scaleEffect 1.3s ease-in-out;
				background: none;
			}
			&:active {
				color: var(--bg-gradient-left);
				transition: all 0.3s ease-in-out;
				transform: scale(1.3) skewX(30px);
				box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
				filter: blur(2px);
				filter: hue-rotate(1deg) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5));
			}
		}
		& p {
			padding: 0.5rem;
			white-space: pre-wrap;
			overflow-wrap: break-word;
			word-wrap: break-word;
			hyphens: auto;
			text-align: left;
		}
	}

	.chat-placeholder img {
		width: 100%;
		transform: translateX(25%) translateY(-20%);
	}

	.dashboard-items {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		transition: all 0.3s ease;
		position: relative;
		// border-top: 1px solid var(--secondary-color);
		left: 0;
		top: 3rem;
		right: 0;
		gap: 0.5rem;
		width: 100%;
		height: auto;
		overflow: none;
		margin-bottom: auto;
		margin-top: 0;
	}

	.dashboard-scroll {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		transition: all 0.3s ease;
		position: relative;
		width: calc(100% - 2rem) !important;
		max-width: 1200px;
		margin-top: 1rem;
		padding: 1rem;
		// animation: pulsateShadow 1.5s infinite alternate;
		border-radius: 2rem;
		flex: 1;
		// overflow-y: scroll !important;
		overflow: hidden !important;
	}
	@media (max-width: 1000px) {
		.container-row {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			top: 0 !important;
			margin-top: 0 !important;
			width: 100% !important;
			margin-top: 0;
			margin-bottom: 0;
			// justify-content:space-between;
			transition: all 0.3s ease;
			gap: 0rem;
		}
	}
</style>
