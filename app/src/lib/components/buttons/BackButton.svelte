<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let size: number = 30;
	export let fallbackUrl: string = '/';
	export let showText: boolean = false;
	export let text: string = 'Back';
	export let className: string = '';

	async function handleBack() {
		if (browser) {
			// Check if we have a referrer from the same origin
			const referrer = document.referrer;
			const currentOrigin = window.location.origin;

			if (referrer && referrer.startsWith(currentOrigin) && window.history.length > 1) {
				// Use history.back() and then invalidate to force refresh
				history.back();

				// Wait a bit for navigation to complete, then invalidate
				setTimeout(async () => {
					await invalidateAll();
				}, 50);
			} else {
				// Fallback to a sensible default with invalidateAll to force refresh
				await goto(fallbackUrl, { invalidateAll: true });
			}
		}
	}
</script>

<button class="back-button {className}" on:click={handleBack} type="button" aria-label="Go back">
	{@html getIcon('ArrowLeft', { size })}
	{#if showText}
		<span class="back-text">{text}</span>
	{/if}
</button>

<style>
	.back-button {
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}

	.back-button:hover {
		background-color: var(--line-color);
	}

	.back-button:focus {
		outline: 2px solid var(--primary-color);
		outline-offset: 2px;
	}

	.back-text {
		margin-left: 0.5rem;
		font-size: 0.9rem;
	}

	/* When text is shown, adjust padding and border radius */
	.back-button:has(.back-text) {
		border-radius: 1.5rem;
		padding: 0.5rem 1rem;
	}
</style>
