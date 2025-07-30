<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Assets from '$lib/features/canvas/components/Assets.svelte';
	import AgentsConfig from './AgentsConfig.svelte';
	import PromptCatalog from '$lib/features/ai/components/prompts/PromptInput.svelte';
	import LocalModelSelector from '$lib/features/ai/components/models/LocalModelSelector.svelte';

	export let userId: string;

	const dispatch = createEventDispatcher();

	let activeTab: 'local' | 'assets' | 'assistant' = 'local';
	let selectedLocalModel: string = 'qwen2.5:0.5b';

	function setActiveTab(tab: 'local' | 'assets' | 'assistant') {
		activeTab = tab;
	}
	function handlePromptSelect(event: CustomEvent) {
		console.log('Prompt selected:', event.detail);
		dispatch('promptSelect', { prompt: event.detail });
	}
	function handleLocalModelSelect() {
		console.log('Local model selected:', selectedLocalModel);
		dispatch('modelSelect', { model: selectedLocalModel });
	}

	const slideTransition = (p0: HTMLDivElement, { duration = 180, delay = 0, direction = 1 }) => {
		return {
			delay,
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				return `
          		transform: translateX(${(1 - eased) * 360 * direction}%) rotateX(${(1 - eased) * 360 * direction}deg);
          		opacity: ${eased};
        `;
			}
		};
	};
</script>

<div
	class="side-menu"
	on:mouseleave={() => dispatch('mouseleave')}
	role="complementary"
	in:fly={{ x: 50, duration: 300, delay: 300 }}
	out:fly={{ x: 50, duration: 300 }}
>
	<div class="tabs">
		<button class:active={activeTab === 'local'} on:click={() => setActiveTab('local')}>
			Local AI
		</button>
		<button class:active={activeTab === 'assets'} on:click={() => setActiveTab('assets')}>
			Assets
		</button>
		<button class:active={activeTab === 'assistant'} on:click={() => setActiveTab('assistant')}>
			Assistant
		</button>
	</div>

	<div class="content">
		{#if activeTab === 'local'}
			<div in:slideTransition={{ direction: -1 }} out:slideTransition={{ direction: 1 }}>
				<LocalModelSelector
					bind:selectedModel={selectedLocalModel}
					on:change={handleLocalModelSelect}
					showDetails={true}
					placeholder="Choose your local AI model..."
				/>
			</div>
		{:else if activeTab === 'assets'}
			<div in:slideTransition={{ direction: 0 }} out:slideTransition={{ direction: 0 }}>
				<AgentsConfig />
			</div>
		{:else if activeTab === 'assistant'}
			<div in:slideTransition={{ direction: 1 }} out:slideTransition={{ direction: -1 }}>
				<PromptCatalog on:select={handlePromptSelect} />
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.side-menu {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background-color: var(--bg-color);
		backdrop-filter: blur(3px);

		transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		overflow: hidden;
		// perspective: 1000px;
	}

	.tabs {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
		width: 100%;
		margin-top: 2rem;
		/* margin: 1rem; */
		/* padding: 1rem; */
		/* background-color: rgba(0, 0, 0, 0.2); */
		/* border-bottom: 1px solid rgba(255, 255, 255, 0.1); */
	}

	.tabs button {
		display: flex;
		width: auto;
		height: auto;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		/* padding: 5px; */
		border: none;
		cursor: pointer;
		color: var(--placeholder-color);
		font-size: 1rem;
		background-color: transparent;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		/* margin: 1rem; */
		/* padding: 1rem; */
	}

	.tabs button:hover {
		/* transform: scale(1.1); */
		background-color: rgba(255, 255, 255, 0.1);
		/* border-radius: 20px; */
	}

	.tabs button.active {
		color: var(--tertiary-color);
		border-bottom: 2px solid var(--tertiary-color);
		/* transform: scale(1.1); */
		/* background-color: rgba(255, 255, 255, 0.05); */
	}

	.search {
		padding: 1rem;
		display: flex;
		width: auto;
		margin-right: 2rem;
	}

	.search textarea {
		padding: 0.5rem;
		width: 100%;
		resize: none;
		background-color: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 4px;
		color: var(--text-color);
	}

	.content {
		position: relative;
		height: calc(100% - 6rem);

		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;

		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}

	.content > div {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
	}
	@media (max-width: 1000px) {
		.left-sidebar {
			background: var(--primary-color);
			height: 80vh;
			width: 100%;
			margin: 2rem;
			border-radius: 0.5rem;
		}
	}

	@media (max-width: 768px) {
		.side-menu {
			width: 100%;
			height: 100%;
			margin: 0;
			position: relative;
			overflow-y: auto;
			border-right: 1px solid var(--line-color);
			border-radius: 0.5rem;
			box-shadow:
				rgba(29, 28, 28, 0.5) 10px 10px 10px 10px,
				rgba(29, 28, 28, 0.5) 0px 10px 10px;
			transition: all 0.3s ease;
		}

		.content {
			position: relative;
			height: 50vh;
		}
	}
</style>
