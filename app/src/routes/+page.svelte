<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { clientTryCatch } from '$lib/utils/errorUtils';
	import { t } from '$lib/stores/translationStore';
	import { toast } from '$lib/utils/toastUtils'; // Add this back

	let pageReady = false;
	let redirectedFromLogin = false;
	let isLoading = true;
	let error: string | null = null;

	onMount(async () => {
		if (!browser) return;

		// Only handle redirects if we're actually on the root page
		if ($page.url.pathname !== '/') {
			pageReady = true;
			isLoading = false;
			return;
		}

		const {
			success,
			error: err,
			data: user
		} = await clientTryCatch(Promise.resolve($currentUser), 'Authentication check failed');

		if (success && user) {
			await goto('/home');
		} else {
			error = err ?? 'Failed to check authentication status';
			toast.error('Authentication failed. Redirecting to welcome page.');
			await goto('/welcome');
		}
	});
</script>

{#if $page.url.pathname === '/'}
	{#if isLoading}
		<div class="spinnter-container">
			<div class="spinner"></div>
		</div>
	{:else if error}
		<div class="error">
			<p>{error}</p>
			<button on:click={() => goto('/welcome')}>Go to Welcome</button>
		</div>
	{:else if pageReady}
		<div class="content">
			<h1>Welcome to the App</h1>
			<p>You shouldn't normally see this page.</p>
			<div class="actions">
				<button on:click={() => goto('/home')}>Go to Home</button>
				<button on:click={() => goto('/chat')}>Go to Chat</button>
			</div>
		</div>
	{/if}
{:else}
	<!-- If not on root path, don't render anything here - let other routes handle themselves -->
	<div style="display: none; margin-top: 3rem;"></div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
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
		color: var(--text-color);
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
