<script lang="ts">
	import { slide, fade } from 'svelte/transition';
	import Headmaster from '$lib/assets/illustrations/headmaster.jpeg';
	import type { FeaturePlan, PricingPlan } from '$lib/types/types.features';

	export let title = '';
	export let features: string[] = [];
	export let isPro = false;
	export let cardId: number | string;

	let isOpen = false;

	function openOverlay() {
		isOpen = true;
	}

	function closeOverlay() {
		isOpen = false;
	}

	function handleOverlayClick(event: MouseEvent) {
		// Close only if the click was on the overlay background, not the card content
		if ((event.target as HTMLElement).classList.contains('overlay')) {
			closeOverlay();
		}
	}
</script>

<div class="card-container">
	<div class="card {isPro ? 'pro-title' : 'free-title'}" on:click={openOverlay}>
		<h3 class={isPro ? 'pro-title' : 'free-title'}>{title}</h3>
		<span class="plan-type {isPro ? 'pro-plan' : 'free-plan'}">{isPro ? 'Pro' : 'Free'}</span>
	</div>
</div>

{#if isOpen}
	<div class="overlay" on:click={handleOverlayClick} transition:fade={{ duration: 200 }}>
		<div class="overlay-content" transition:slide={{ duration: 300 }}>
			<img src={Headmaster} alt="Notes illustration" class="illustration" />

			<h2>{title}</h2>
			<span class="plan-type-overlay {isPro ? 'pro-plan' : 'free-plan'}"
				>{isPro ? 'Pro' : 'Free'}</span
			>
			<div class="content">
				{#each features as feature}
					<li>{feature}</li>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.card-container {
		display: flex;
		flex-wrap: wrap;
		vertical-align: top;
	}

	.card {
		padding: 1rem;
		text-align: center;
		transition: border 0.3s ease;
		position: relative;
		border: 1px solid var(--bg-color);
		border-radius: 20px;
		width: auto;
		flex: 1;
		z-index: 10;
		&.selected {
			border: 1px solid var(--tertiary-color);
			/* You can add more styles for the selected state here */
		}
		&.pro-title {
			background-color: var(--bg-color);
		}
		&.free-title {
			background-color: var(--primary-color);
		}
	}

	.card:hover {
		border: 1px solid var(--tertiary-color);
		z-index: 11;
	}

	.card h3 {
		font-size: 1.4rem;
		text-align: left;
		margin-bottom: 1rem;
		color: var(--text-color);
		&.pro-title {
			color: var(--placeholder-color);
			margin: 1rem;
		}
		&.free-title {
			color: var(--text-color);
			margin: 1rem;
		}
	}

	.illustration {
		position: absolute;
		opacity: 0.03;
		transform: scale(0.5) translateX(-50%) translateY(-60%);
	}

	.plan-type-overlay,
	.plan-type {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		font-size: 0.9rem;
		font-weight: 800;
		padding: 0.2rem 0.5rem;
		border-radius: 5px;
		color: var(--bg-color);

		&.free-plan {
			background: var(--tertiary-color);
			color: var(--primary-color);
		}
		&.pro-plan {
			background: var(--placeholder-color);
		}
	}

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 100;
	}

	.overlay-content {
		background: var(--bg-gradient);
		width: 80%;
		max-width: 500px;
		max-height: 80vh;
		overflow: hidden;
		padding: 2rem;
		border-radius: 20px;
		position: relative;
		border: 1px solid var(--tertiary-color);
	}

	.overlay-content h2 {
		font-size: 2rem;
		text-align: left;
		margin-bottom: 1.5rem;
		color: var(--text-color);
	}

	.content {
		margin-top: 1rem;
	}

	.content li {
		color: var(--text-color);
		text-align: left;
		font-size: 1.3rem;
		line-height: 1.5;
		margin-left: 1rem;
		margin-bottom: 0.75rem;
	}

	@media (max-width: 767px) {
		.card-container {
			width: calc(50% - 2rem);
		}
		.card {
			height: 100px;
		}
	}
</style>
