<script lang="ts">
	import type { PromptType } from '$lib/types/types';
	import { createEventDispatcher } from 'svelte';
	import { availablePrompts } from '$lib/features/ai/utils/prompts';
	import { promptStore } from '$lib/stores/promptStore';
	import { fly } from 'svelte/transition';
	import { slide } from 'svelte/transition';

	// Use the store value
	$: selectedPrompt = $promptStore;
	$: selectedIcon = availablePrompts.find((option) => option.value === selectedPrompt)?.icon;

	const dispatch = createEventDispatcher<{
		select: PromptType;
	}>();

	let hoveredPrompt: PromptType | null = null;

	function handlePromptSelection(event) {
		const { isDual, prompts, prompt } = event.detail;

		if (isDual && Array.isArray(prompts) && prompts.length === 2) {
			dualResponseSystemPrompts = prompts;
			console.log('Selected dual prompts for comparison:', prompts);
		} else if (prompt) {
			systemPrompt = prompt;
		}
	}

	function handleMouseEnter(value: PromptType) {
		hoveredPrompt = value;
	}

	function handleMouseLeave() {
		hoveredPrompt = null;
	}

	$: selectedPromptLabel =
		availablePrompts.find((option) => option.value === selectedPrompt)?.label || '';
</script>

<div class="prompt-overlay">
	<div class="prompt-grid-container" role="menu">
		{#each availablePrompts as { value, label, icon: Icon, description, youtubeUrl }}
			<div
				class="prompt-grid-item"
				class:active={selectedPrompt === value}
				on:click|stopPropagation={() => handlePromptSelection(value)}
				on:mouseenter={() => handleMouseEnter(value)}
				on:mouseleave={handleMouseLeave}
			>
				<div class="icon-wrapper">
					<Icon color="var(--text-color)" />
				</div>
				<h3>{label}</h3>
			</div>
			<div class="content-wrapper" class:hovered={hoveredPrompt === value}>
				<div class="content-header"></div>

				{#if selectedPrompt === value || hoveredPrompt === value}
					<!-- <div class="icon-wrapper-big">
					<Icon color="var(--text-color)" size={100} />
				</div> -->
					<p
						class="description"
						class:hovered={hoveredPrompt === value}
						transition:fly={{ y: 20, duration: 300 }}
					>
						{description}
					</p>
					{#if youtubeUrl}
						<div class="video-container" class:hovered={hoveredPrompt === value} transition:slide>
							<iframe
								transition:fly={{ y: 20, duration: 300 }}
								width="560"
								height="315"
								src={youtubeUrl}
								title="YouTube video player"
								frameborder="0"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
							></iframe>
						</div>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	* {
		/* font-family: 'Merriweather', serif; */
		/* font-family: 'Roboto', sans-serif; */
		/* font-family: 'Montserrat'; */
		/* color: var(--text-color); */
		font-family: var(--font-family);
	}
	.prompt-overlay {
		display: flex;
		position: relative;
		border-top-left-radius: var(--radius-m);
		width: 100%;
		margin-left: 2rem;
		margin-right: 2rem;
		backdrop-filter: blur(10px);
		justify-content: center;
		align-items: center;
		// backdrop-filter: blur(100px);
		border-radius: var(--radius-m);
		background: var(--bg-gradient);
	}

	.prompt-grid-container {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		width: 100%;
		height: auto;
		// box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
		// backdrop-filter: blur(100px);
		margin: 1rem;
		padding: 1rem;
		border-radius: var(--radius-m);
	}

	.prompt-grid-item {
		display: flex;
		max-width: 200px;

		padding: 1.2rem 0;
		border-radius: var(--radius-m);
		background: var(--primary-color);
		cursor: pointer;
		gap: 1rem;
		padding-left: 1rem;
		transition: all 0.3s ease;
		&.active {
			// backdrop-filter: blur(20px);
			height: auto;
			margin-left: 0;
			background: transparent;
			h3 {
				font-size: 1.4rem !important;
			}
		}

		&:hover {
			// box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
			background: var(--primary-color);
			transform: translateX(0.5rem);
			letter-spacing: 0.3rem;
			z-index: 2001;
		}

		.icon-wrapper {
			display: flex;
			align-items: center;
			color: var(--text-color);

			svg {
				color: var(--primary-color);
				stroke: var(--primary-color);
				fill: var(--tertiary-color);
			}
		}
	}
	.icon-wrapper-big {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		width: 50%;
		height: auto;
		padding: 0;
	}

	.icon-wrapper-big svg {
		color: var(--primary-color);
		stroke: var(--primary-color);
		fill: var(--primary-color);
		width: 4rem;
		height: 4rem;
	}
	.content-wrapper {
		display: flex;
		flex-direction: column;
		position: absolute;
		right: 0;
		top: 0;
		left: calc(200px + 2rem);
		width: 100%;

		&.hovered {
			background: var(--bg-gradient);
			z-index: 2000;
			color: var(--tertiary-color);
			font-size: 1.1rem;
			margin-left: 0;
			margin-top: 0;
			margin-right: 4rem;
		}
	}

	.content-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	h3 {
		margin: 0;
		color: var(--text-color);
		font-size: calc(0.5rem + 1vmin);
	}

	.description {
		font-size: 1.2rem;
		line-height: 1.5;
		width: 74%;
		display: flex;
		position: relative;
		bottom: 0;
		height: auto;
		line-height: 1.9rem;
		justify-content: center;
		align-items: center;
		margin-left: 3rem;
		text-align: justify;
		height: auto;
		color: text-color;
		letter-spacing: 0.1rem;
	}

	.video-container {
		width: calc(100% - 200px);
		right: 0;
		top: 1rem;
		bottom: 2rem;
		position: relative;
		padding-top: 64%; /* 16:9 Aspect Ratio */
		overflow: hidden;
		margin: 1rem 0;
		pointer-events: auto;

		iframe {
			position: absolute;
			top: 0%;
			left: 5%;
			width: 90%;
			height: 50%;
			border-radius: 1rem;
			border: 1px solid rgba(255, 255, 255, 0.2);
		}
	}

	@media (max-width: 768px) {
		.prompt-overlay {
			margin-right: 0;
			right: 0;
		}
		.prompt-grid-container {
			flex-direction: column;
			width: 100%;
			gap: 2px;
			background: transparent;
		}
		.prompt-grid-item {
			width: 100%;
		}

		.video-container {
			margin: 0.5rem 0;
		}

		.content-wrapper {
			position: relative;
			width: 100%;
			display: none;
		}
	}
</style>
