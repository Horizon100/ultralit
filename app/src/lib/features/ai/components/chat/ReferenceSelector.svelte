<script lang="ts">
	import { currentCite, availableCites, type Cite } from '$lib/stores/citeStore';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';

	export let selectedText = '';
	export let position: { top: number; left: number } = { top: 0, left: 0 };

	const showTooltip = writable(false);
	const isLoading = writable(false);

	// Define base URLs for each source
	const sourceUrls: Record<Cite, string> = {
		wiki: 'https://en.wikipedia.org/wiki/',
		quora: 'https://www.quora.com/search?q=',
		x: 'https://twitter.com/search?q=',
		google: 'https://www.google.com/search?q=',
		reddit: 'https://www.reddit.com/search/?q='
	};

	// Friendly names for display
	const sourceNames: Record<Cite, string> = {
		wiki: 'Wikipedia',
		quora: 'Quora',
		x: 'X (Twitter)',
		google: 'Google',
		reddit: 'Reddit'
	};

	/*
	 * Remove the duplicate currentCite declaration and subscription
	 * The store is already properly initialized in citeStore.ts
	 */

	async function openReference(cite: Cite) {
		if (!selectedText) return;

		isLoading.set(true);

		try {
			const encodedQuery = encodeURIComponent(selectedText);
			const baseUrl = sourceUrls[cite];
			const url = `${baseUrl}${encodedQuery}`;

			await new Promise((resolve) => setTimeout(resolve, 300)); // Small delay for UX

			window.open(url, '_blank');
		} catch (error) {
			console.error('Error opening reference:', error);
		} finally {
			isLoading.set(false);
		}
	}
</script>

<div
	class="reference-selector"
	style={`top: ${position.top}px; left: ${position.left}px`}
	on:mouseenter={() => showTooltip.set(true)}
	on:mouseleave={() => showTooltip.set(false)}
>
	<p>Toggle your message cite sources</p>
	{#each availableCites as cite}
		<button
			class:active={cite === $currentCite}
			on:click={() => currentCite.set(cite)}
			disabled={$isLoading}
		>
			{sourceNames[cite]}
		</button>
	{/each}
	<!-- <button
      class="reference-button"
      on:click={() => openReference($currentCite)}
      title={`Search on ${sourceNames[$currentCite]}`}
      disabled={$isLoading}
    >
      {#if $isLoading}
        <span class="loading-indicator">Searching...</span>
      {:else}
        {sourceNames[$currentCite]}
      {/if}
    </button> -->

	<!-- {#if $showTooltip && !$isLoading}
      <div class="cite-options-tooltip">
        <div class="tooltip-arrow"></div>
        {#each availableCites as cite}
          <button
            class:active={cite === $currentCite}
            on:click={() => currentCite.set(cite)}
            disabled={$isLoading}
          >
            {sourceNames[cite]}
          </button>
        {/each}
      </div>
    {/if} -->
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;
	.reference-selector {
		width: 100%;
		height: 4rem;
		padding: 1rem;
		border-radius: 2rem;
		margin: 0 auto;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		flex-direction: row;
		gap: 1rem;
	}

	button.active {
		background: var(--tertiary-color);
		font-weight: 800;
	}
	button {
		padding: 6px 12px;
		background: var(--secondary-color);
		color: white;
		border: none;
		border-radius: 1rem;
		cursor: pointer;
		letter-spacing: 0.2rem;
		font-size: 1.2em;
		transition: all 0.2s ease;
		position: relative;
		width: auto !important;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			background: var(--primary-color);
		}

		&:disabled {
			opacity: 0.7;
			cursor: wait;
		}
	}

	.reference-button:hover:not(:disabled) {
		background: var(--primary-color);
	}

	.loading-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;

		&::after {
			content: '';
			display: inline-block;
			width: 12px;
			height: 12px;
			border: 2px solid rgba(255, 255, 255, 0.3);
			border-radius: 50%;
			border-top-color: white;
			animation: spin 1s linear infinite;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.cite-options-tooltip {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
		justify-content: right;
		// padding: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
		border-radius: var(--radius-m);
		transition: all ease 0.3s;
	}

	.cite-options-tooltip button {
		padding: 6px 12px;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.85em;
		border-radius: 3px;

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.cite-options-tooltip button:hover:not(:disabled) {
		background: var(--hover-color);
	}

	.cite-options-tooltip button.active {
		background: var(--primary-light);
		color: var(--primary-color);
		font-weight: 500;
	}

	.tooltip-arrow {
		position: absolute;
		top: -5px;
		left: 10px;
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-bottom: 5px solid var(--bg-color);
	}
</style>
