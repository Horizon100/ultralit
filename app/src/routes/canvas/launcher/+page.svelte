<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import {
		X,
		Bot,
		Wrench,
		Workflow,
		Target,
		Settings2,
		Plus,
		SquareMenu,
		Box,
		Trash2,
		Check,
	} from 'lucide-svelte';
	import AgentsConfig from '$lib/features/agents/components/AgentsConfig.svelte';
	import ModelsConfig from '$lib/features/ai/components/models/ModelsConfig.svelte';
	import ActionsConfig from '$lib/features/canvas/components/ActionsConfig.svelte';
	import ObjectivesConfig from '$lib/features/canvas/components/ObjectivesConfig.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { agentStore } from '$lib/stores/agentStore';
	import CursorEffect from '$lib/features/canvas/components/CursorEffect.svelte';
	import GenericOverlay from '$lib/components/modals/GenericOverlay.svelte';
	import type { Workspaces, Workshops } from '$lib/types/types';
	import { currentUser } from '$lib/pocketbase';
	import { quotes } from '$lib/translations/quotes';

	let showOverlay = false;
	let overlayContent = '';
	let touchStartY = 0;
	let currentWorkspace: Workspaces | null = null;
	let currentWorkspaceId: string | null = null;
	let workshopCount = 0;
	let isNavExpanded = false;
	let innerWidth: number;
	let showGenericOverlay = false;
	let genericOverlayContent = '';
	let workspaces: Workspaces[] = [];
	let currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
	let isScrolling = false;
	let startX: number;
	let scrollLeft: number;
	let showWorkspaceList = false;
	let editingWorkspace: string | null = null;
	let editedName: string = '';
	let confirmationMessage: string | null = null;
	let textareaElement: HTMLTextAreaElement | null = null;
	let showBuilder = false;
	let isLoading = false;
	let showFade = false;
	let showH2 = false;

	$: user = $currentUser;

	$: isNarrowScreen = innerWidth <= 700;


	$: if ($page.params.workspaceId !== currentWorkspaceId) {
		currentWorkspaceId = $page.params.workspaceId;
		if (currentWorkspaceId && $currentUser && $currentUser.id) {
			agentStore.loadAgents(currentWorkspaceId);
		}
	}

	onMount(() => {
		user = $currentUser;
		setTimeout(() => (showFade = true), 50);
		setTimeout(() => (showH2 = true), 50);
	});




	function showConfirmation(message: string, isError: boolean = false) {
		confirmationMessage = message;
		setTimeout(() => {
			confirmationMessage = null;
		}, 3000);
	}

	function toggleOverlay(content: string) {
		if (overlayContent === content && showOverlay) {
			closeOverlay();
		} else {
			overlayContent = content;
			showOverlay = true;
		}
	}

	function closeOverlay() {
		showOverlay = false;
		overlayContent = '';
	}

	function handleTouchStart(event: TouchEvent) {
		touchStartY = event.touches[0].clientY;
	}

	function handleTouchMove(event: TouchEvent) {
		const touchEndY = event.touches[0].clientY;
		const deltaY = touchEndY - touchStartY;
		if (deltaY > 50) {
			closeOverlay();
		}
	}

	function goBack() {
		// goto('/launcher/');
	}


	function toggleNav() {
		isNavExpanded = !isNavExpanded;
	}

	function closeGenericOverlay() {
		showGenericOverlay = false;
		genericOverlayContent = '';
	}


</script>

<svelte:window bind:innerWidth />

{#if showH2}
	<div class="layout" in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}>
		<!-- <img src={itImage} alt="Italian illustration" class="illustration" /> -->

		{#if isLoading}
			<div class="loading-overlay">
				<LoadingSpinner />
			</div>
		{/if}

		<nav class="config-selector" class:collapsed={!isNavExpanded && isNarrowScreen}>
			{#if isNarrowScreen}
				<button class="toggle-nav" on:click={toggleNav}>
					<SquareMenu size={24} class="nav-icon" />
				</button>
			{/if}

			<button
				class={overlayContent === 'Agents' ? 'active' : ''}
				on:click={() => toggleOverlay('Agents')}
			>
				<Bot size={24} class="nav-icon" />
			</button>
			<button
				class={overlayContent === 'Models' ? 'active' : ''}
				on:click={() => toggleOverlay('Models')}
			>
				<Settings2 size={24} class="nav-icon" />
			</button>
			<button
				class={overlayContent === 'Actions' ? 'active' : ''}
				on:click={() => toggleOverlay('Actions')}
			>
				<Wrench size={24} class="nav-icon" />
			</button>
			<button
				class={overlayContent === 'Flows' ? 'active' : ''}
				on:click={() => toggleOverlay('Flows')}
			>
				<Workflow size={24} class="nav-icon" />
			</button>
			<button
				class={overlayContent === 'Objectives' ? 'active' : ''}
				on:click={() => toggleOverlay('Objectives')}
			>
				<Target size={24} class="nav-icon" />
			</button>
		</nav>

		<CursorEffect />

		<main>
			<slot />
		</main>

		{#if showOverlay}
			<div
				class="overlay"
				on:click={closeOverlay}
				on:touchstart={handleTouchStart}
				on:touchmove={handleTouchMove}
				transition:fade={{ duration: 200 }}
			>
				<div class="overlay-content" on:click|stopPropagation transition:slide={{ duration: 200 }}>
					<button class="close-button" on:click={closeOverlay} transition:fade={{ duration: 300 }}>
						<X size={30} />
					</button>

					{#key overlayContent}
						<div in:fly={{ x: -50, duration: 300, delay: 300 }} out:fly={{ x: 50, duration: 300 }}>
							{#if overlayContent === 'Agents'}
								<AgentsConfig />
							{:else if overlayContent === 'Models'}
								<ModelsConfig />
							{:else if overlayContent === 'Actions'}
								<ActionsConfig />
							{:else if overlayContent === 'Objectives'}
								<ObjectivesConfig />
							{/if}
						</div>
					{/key}
				</div>
			</div>
		{/if}

	</div>
{/if}

{#if showGenericOverlay}
	<GenericOverlay on:close={closeGenericOverlay} title={genericOverlayContent}>
		<p>This is the content for {genericOverlayContent}</p>
	</GenericOverlay>
{/if}

<style>
	.layout {
		position: absolute;
		justify-content: center;
		align-items: center;
		margin-left: auto;
		margin-right: auto;
		width: auto;
		left: 4rem;
		right: 0.5rem;
		height: 97vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		/* background-color: #010e0e; */
		border-radius: 40px;
	}

	main {
		flex-grow: 1;
		overflow-y: auto;
		padding: 20px;
	}

	.workspace-container {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.workspace-selector:hover + .workspace-name {
		opacity: 0;
	}

	.config-selector {
		display: flex;
		flex-direction: row;
		position: absolute;
		left: calc(50%-200px);
		top: 0.5rem;
		padding: 20px 10px;
		justify-content: space-between;
		align-items: center;
		z-index: 1002;
		width: 400px;
		border-radius: 20px;
		/* background-color: #262929; */
		transition: all 0.3s ease;
	}

	.config-selector.expanded {
		width: 80%;
	}

	.config-selector button {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		font-size: 20px;
		border: none;
		background-color: transparent;
		color: rgb(133, 133, 133);
		cursor: pointer;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.config-selector button.active {
		color: white;
		transform: scale(1.5);
	}

	.toggle-nav {
		display: none;
	}

	.overlay {
		position: fixed;
		backdrop-filter: blur(10px);
		display: flex;
		justify-content: flex-end;
		align-items: flex-start;
		overflow: hidden;
		width: 98%;
		border-radius: 20px;
	}

	.overlay-content {
		backdrop-filter: blur(10px);
		border-top-right-radius: 10px;
		border-bottom-right-radius: 10px;
		height: 100%;
		margin-top: 0;
		overflow: hidden;
		position: relative;
		left: auto;

	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: white;
	}

	.workspace-selector {
		display: flex;
		flex-direction: row;
		position: relative;
		align-items: center;
		justify-content: flex-start;
		left: 20px;
		top: 20px;
		overflow-x: scroll;
		height: 60px;
		width: 600px;
		background-color: red;
		user-select: none;
		scroll-behavior: smooth;
		scrollbar-width: thin;
		scrollbar-color: transparent transparent;
		white-space: nowrap;
		-webkit-overflow-scrolling: touch;
		transition: all 0.3s ease;
	}

	.workspace-selector:hover {
		width: 90%;
		overflow-x: scroll;
		overflow-y: hidden;
		z-index: 10000;
	}

	.workspace-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: transparent;
		color: white;
		border: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: 10px;
		transition: all 0.3s ease;
		scroll-snap-align: start;
	}

	.workspace-selector:hover .workspace-button {
		width: 90%;
		border-radius: 50px;
		flex-direction: row;
		justify-content: flex-start;
		gap: 10px;
		text-align: left;
	}

	.workspace-avatar,
	:global(.default-avatar) {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
		transition: all 0.3s ease;
	}

	.workspace-selector:hover .workspace-avatar,
	.workspace-selector:hover :global(.default-avatar) {
		width: 40px;
		height: 40px;
		margin-left: 10px;
	}

	.workspace-button span {
		display: none;
		font-size: 8px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: all 0.3s ease;
		font-family: 'Lora', serif;
	}

	.workspace-selector:hover .workspace-button span {
		display: inline;
		font-size: 18px;
	}

	.workspace-name {
		margin-left: 20px;
		font-size: 18px;
		opacity: 1;
		transition: opacity 0.3s ease;
	}

	.overlay {
		position: relative;
		bottom: 1rem;
		left: 0;
		right: 0;
		height: 100vh;
		/* background: linear-gradient(
      90deg,
      rgba(117, 118, 114, 0.9) 0%,
      rgba(0, 0, 0, 0.85) 5%,
      rgba(117, 118, 114, 0.8) 10%,
      rgba(117, 118, 114, 0.75) 15%,
      rgba(117, 118, 114, 0.7) 20%,
      rgba(0, 0, 0, 0.65) 25%,
      rgba(117, 118, 114, 0.6) 30%,
      rgba(0, 0, 0, 0.55) 35%,
      rgba(0, 0, 0, 0.5) 40%,
      rgba(117, 118, 114, 0.45) 45%,
      rgba(0, 0, 0, 0.4) 50%,
      rgba(0, 0, 0, 0.35) 55%,
      rgba(117, 118, 114, 0.3) 60%,
      rgba(117, 118, 114, 0.25) 65%,
      rgba(117, 118, 114, 0.2) 70%,
      rgba(117, 118, 114, 0.15) 75%,
      rgba(0, 0, 0, 0.1) 80%,
      rgba(1, 1, 1, 0.05) 85%,
      rgba(117, 118, 114, 0) 100%
    ); */
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}


	.overlay-handle {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		padding: 10px;
		height: 80px;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
	}

	.lists-container {
		display: flex;
		flex-direction: column;
		background-color: #1c1b1d;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 90%
		);
		width: 100%;
		border-bottom-left-radius: 20px;
		border-bottom-right-radius: 20px;
	}

	.workspace-list {
		background-color: #1c1b1d;
		max-height: calc(80vh - 40px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		border-radius: 20px;
		gap: 4px;
		margin-bottom: 20px;
		overflow: hidden;
	}

	.workspace-list-item {
		display: flex;
		flex-direction: row;
		width: 100%;
		padding: 10px;
		background: linear-gradient(to top, #1a1a1a, #212121);
		align-items: center;
		gap: 10px;
		color: white;
		border: none;
		text-align: left;
		font-size: 20px;
		cursor: pointer;
		transition: background 0.3s;
		user-select: none;
	}

	.workspace-list-item:hover {
		background: #5a5a58;
	}

	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 9999;
	}

	.illustration {
		position: absolute;
		width: 95%;
		height: auto;
		left: 5%;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.025;
		z-index: 1;
		pointer-events: none;
	}

	@media (max-width: 700px) {
		.config-selector {
			width: auto;
			left: 0;
		}

		.config-selector.expanded {
			width: 80%;
			flex-wrap: wrap;
			justify-content: flex-start;
		}

		.config-selector:not(.expanded) {
			width: 60px;
			height: 60px;
		}

		.config-selector.collapsed {
			width: 100%;
			height: 30px;
			display: flex;
			background-color: black;
			gap: 10px;
			bottom: 0;
			left: 0;
			align-items: center;
			justify-content: center;
		}

		.config-selector:not(.expanded) button:not(.toggle-nav) {
			display: none;
		}

		.config-selector.expanded button {
			display: flex;
		}

		.toggle-nav {
			display: flex;
			position: absolute;
			left: 1rem;
			bottom: 1rem;
		}

		.config-selector button:not(.toggle-nav) {
			display: none;
		}

		.config-selector.collapsed button:not(.toggle-nav) {
			display: flex;
		}

		.nav-icon {
			width: 20px;
			height: 20px;
		}

		.workspace-selector:hover .workspace-avatar,
		.workspace-selector:hover :global(.default-avatar) {
			width: 30px;
			height: 30px;
		}

		.workspace-handle,
		.workspace-selector:hover ~ .workspace-handle {
			left: 80px;
		}

		.workspace-avatar,
		:global(.default-avatar) {
			width: 30px;
			height: 30px;
		}

		.workspace-button span {
			display: none;
			font-size: 8px;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.menu-button {
			transform: scale(0.7);
		}

		.menu-button .nav-icon {
			width: 20px;
			height: 20px;
		}

		.workshop-count {
			width: 30px;
			height: 30px;
			font-size: 16px;
		}
	}

	h1 {
		font-size: 30px;
		margin: 0;
		color: white;
		width: 100%;
		text-align: center;
	}

	p {
		padding: 10px;
		transition: color 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		user-select: none;
	}

	p:hover {
		color: red;
	}

	.spacer {
		flex-grow: 1;
		position: absolute;
		right: 1rem;
		margin-right: 10px;
	}

	.spacer:hover {
		color: red;
	}

	.icon-button,
	.check-button {
		background: none;
		border: none;
		cursor: pointer;
		color: white;
		padding: 5px;
		transition: color 0.3s;
		margin-right: 30px;
	}

	.icon-button:hover {
		color: #ff4136;
	}

	.check-button:hover {
		color: #4caf50;
	}

	.confirmation-message {
		position: fixed;
		top: 20px;
		right: 20px;
		background-color: #4caf50;
		color: white;
		padding: 10px 20px;
		border-radius: 5px;
		z-index: 1001;
	}

	.confirmation-message.error {
		background-color: #f44336;
	}

	input {
		display: flex;
		width: 100%;
		padding: 30px;
		background: linear-gradient(to top, #1a1a1a, #212121);
		align-items: center;
		gap: 10px;
		color: white;
		border: none;
		text-align: left;
		font-size: 20px;
		cursor: pointer;
		border-radius: 14px;
		transition: background 0.3s;
	}

	input:focus {
		outline: none;
		border-bottom-color: #45a049;
	}

	textarea {
		width: 98%;
		padding: 20px;
		text-justify: center;
		justify-content: center;
		resize: none;
		font-size: 16px;
		letter-spacing: 1.4px;
		border: none;
		border-radius: 20px;
		background-color: #21201d;
		color: #818380;
		line-height: 1.4;
		height: auto;
		text-justify: center;
		box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
		overflow: scroll;
		scrollbar-width: none;
		scrollbar-color: #21201d transparent;
		vertical-align: middle;
	}

	textarea:focus {
		outline: none;
		border: 2px solid #000000;
		color: white;
	}

	.cta-button {
		display: flex;
		flex-direction: row;
		width: 100%;
		height: 50px;
		padding: 20px;
		font-size: 26px;
		font-weight: bolder;
		text-align: center;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
	}

	.hero-container {
		justify-content: center;
		align-items: center;
		margin-left: 35%;
		margin-top: 10%;
		width: 30%;
		height: 50%;
		display: flex;
		flex-direction: column;
	}

	.toggle-button {
		position: absolute;
		top: 20px;
		right: 20px;
		padding: 10px 20px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 16px;
		transition: background-color 0.3s;
	}

	.toggle-button:hover {
		background-color: #45a049;
	}

	@media (min-width: 1200px) and (max-width: 1599px) {
		.hero-container {
			width: 50%;
			margin-left: 25%;
			margin-right: 25%;
		}

		h2 {
			display: none;
			font-size: 40px;
			color: #fff;
			justify-content: center;
			align-items: center;
		}
	}

	@media (min-width: 992px) and (max-width: 1199px) {
		.hero-container {
			width: 50%;
			margin-left: 25%;
			margin-right: 25%;
		}

		h2 {
			font-size: 40px;
		}
	}

	@media (min-width: 768px) and (max-width: 991px) {
		.hero-container {
			width: 70%;
			margin-left: 15%;
			margin-right: 15%;
		}

		h2 {
			font-size: 34px;
		}
	}

	@media (max-width: 767px) {
		.hero-container {
			width: 90%;
			margin-left: 5%;
		}

		.layout {
			height: 93vh;
			left: 1rem;
		}
		.workspace-selector {
			width: 100%;
			margin-left: 0;
			padding: 5px;
		}

		.workspace-button {
			width: 150px;
			height: 50px;
			font-size: 14px;
			padding: 5px;
		}

		.menu-button {
			scale: 0.5;
			padding: 0 5px;
			height: 40px;
			width: 40px;
		}

		.menu-button svg {
			width: 20px;
			height: 20px;
		}

		.workspace-menu {
			height: 40px;
			margin-bottom: 5px;
		}

		.footer {
			bottom: 0;
		}

		h2 {
			font-size: 24px;
		}

		p {
			font-size: 10px;
		}
	}
</style>
