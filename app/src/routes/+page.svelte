<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { clientTryCatch } from '$lib/utils/errorUtils';
	import { t } from '$lib/stores/translationStore';

	let pageReady = false;
	let redirectedFromLogin = false;
	let isLoading = true;
	let error: string | null = null;

	onMount(async () => {
		if (browser) {
			const {
				success,
				error: err,
				data: user
			} = await clientTryCatch(Promise.resolve($currentUser), 'Authentication check failed');

			if (success && user) {
				await goto('/home');
			} else {
				error = err ?? 'Failed to check authentication status';
				await goto('/welcome');
			}

			isLoading = false;
		}
	});
</script>

{#if isLoading}
	<div class="loading-container">
		<div class="loading-content">
			<div class="spinner"></div>
			<p>{$t('loading')}</p>
		</div>
	</div>
{/if}

<!-- Error state -->
{#if error}
	<div class="error-container">
		<div class="error-content">
			<h2>Authentication Error</h2>
			<p>{error}</p>
			<button class="error-button" on:click={() => goto('/welcome')}> Go to Welcome </button>
		</div>
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.loading-container,
	.error-container {
		display: flex;
		min-height: 100vh;
		width: 100%;
		align-items: center;
		justify-content: center;
		background-color: var(--bg-color);
		color: var(--text-color);
	}

	.loading-content,
	.error-content {
		text-align: center;
		max-width: 400px;
		padding: 2rem;
	}

	.spinner {
		width: 3rem;
		height: 3rem;
		border: 3px solid var(--line-color);
		border-top: 3px solid var(--primary-color);
		border-radius: 50%;
		margin: 0 auto 1rem auto;
		animation: spin 1s linear infinite;
	}

	.loading-content p {
		color: var(--text-color);
		opacity: 0.8;
	}

	.error-content h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--tertiary-color);
	}

	.error-content p {
		margin-bottom: 1.5rem;
		opacity: 0.9;
	}

	.error-button {
		padding: 0.75rem 1.5rem;
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.error-button:hover {
		background-color: var(--secondary-color);
		transform: translateY(-1px);
	}

	.error-button:active {
		transform: translateY(0);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
