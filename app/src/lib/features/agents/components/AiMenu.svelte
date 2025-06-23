<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Assets from '$lib/features/canvas/components/Assets.svelte';
	import AgentsConfig from './AgentsConfig.svelte';
	import PromptCatalog from '$lib/features/ai/components/prompts/PromptInput.svelte';

	export let width: number;
	export let userId: string;

	const dispatch = createEventDispatcher();

	let activeTab: 'assets' | 'assistant' = 'assets';

	function setActiveTab(tab: 'assets' | 'assistant') {
		activeTab = tab;
	}
	function handlePromptSelect(event: CustomEvent) {
		console.log('Prompt selected:', event.detail);
		dispatch('promptSelect', { prompt: event.detail });
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
	style="width: {width}px;"
	on:mouseleave={() => dispatch('mouseleave')}
	role="complementary"
	in:fly={{ x: 50, duration: 300, delay: 300 }}
	out:fly={{ x: 50, duration: 300 }}
>
	<div class="tabs">
		<button class:active={activeTab === 'assets'} on:click={() => setActiveTab('assets')}
			>Assets</button
		>

		<button class:active={activeTab === 'assistant'} on:click={() => setActiveTab('assistant')}
			>Assistant</button
		>
	</div>
	<div class="search">
		<textarea placeholder="Search..."></textarea>
	</div>
	<div class="content">
		{#if activeTab === 'assets'}
			<div in:slideTransition={{ direction: -1 }} out:slideTransition={{ direction: 1 }}>
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
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.side-menu {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		max-width: auto;
		background-color: rgba(54, 63, 63, 0.1);
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
		height: 50px;
		margin-top: 1rem;
		/* margin: 1rem; */
		/* padding: 1rem; */
		/* background-color: rgba(0, 0, 0, 0.2); */
		/* border-bottom: 1px solid rgba(255, 255, 255, 0.1); */
	}

	.tabs button {
		display: flex;
		width: 50%;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		/* padding: 5px; */
		border: none;
		cursor: pointer;
		color: white;
		font-size: 16px;
		background-color: transparent;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		transform: scale(1);
		/* margin: 1rem; */
		/* padding: 1rem; */
	}

	.tabs button:hover {
		/* transform: scale(1.1); */
		background-color: rgba(255, 255, 255, 0.1);
		/* border-radius: 20px; */
	}

	.tabs button.active {
		padding: 20px;
		border-bottom: 2px solid #ffffff;
		/* transform: scale(1.1); */
		/* background-color: rgba(255, 255, 255, 0.05); */
	}

	.search {
		padding: 1rem;
	}

	.search textarea {
		width: 100%;
		padding: 0.5rem;
		resize: none;
		background-color: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 4px;
		color: white;
	}

	.content {
		position: relative;
		height: calc(100% - 100px); /* Adjust based on your tabs and search height */
		overflow: auto;
	}

	.content > div {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
	}
	@media (max-width: 1000px) {
		.side-menu {
			display: flex;
			flex-direction: column;
			height: 100%;
			backdrop-filter: blur(3px);
			background: var(--primary-color);
			transition: width 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
			overflow: hidden;
			// perspective: 1000px;
		}
	}
</style>
