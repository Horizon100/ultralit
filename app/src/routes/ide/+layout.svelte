<script lang="ts">
	// IDE Layout
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { clientTryCatch } from '$lib/utils/errorUtils';
	import { toast } from '$lib/utils/toastUtils';
	import Toast from '$lib/components/modals/Toast.svelte';

	let isAuthenticated = false;
	let isLoading = true;

	onMount(async () => {
		if (!browser) return;

		const {
			success,
			error: err,
			data: user
		} = await clientTryCatch(Promise.resolve($currentUser), 'Authentication check failed');

		if (success && user) {
			isAuthenticated = true;
		} else {
			toast.error('Access denied. Please log in.');
			await goto('/welcome');
			return;
		}

		isLoading = false;
	});
</script>

{#if isLoading}
	<div class="loading-container">
		<div class="spinner"></div>
		<p>Checking authentication...</p>
	</div>
{:else if isAuthenticated}
	<slot />
{/if}

<Toast />

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	/* Reset CSS */
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	/* Fonts for the editor */
	@font-face {
		font-family: 'JetBrains Mono';
		src: url('https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono-Regular.woff2')
			format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
			'Helvetica Neue', sans-serif;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background-color: var(--bg-color);
		color: var(--text-color);
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--line-color);
		border-top: 2px solid var(--primary-color);
		border-radius: 50%;
		margin-bottom: 1rem;
		animation: spin 1s linear infinite;
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