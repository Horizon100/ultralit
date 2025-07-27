<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { toast } from '$lib/utils/toastUtils';
	import { goto } from '$app/navigation';
	import { clientTryCatch } from '$lib/utils/errorUtils';

	let isAuthenticated = false;
	let isLoading = true;

	onMount(async () => {
		if (!browser) return;

		// Check authentication first
		const {
			success,
			error: err,
			data: user
		} = await clientTryCatch(Promise.resolve($currentUser), 'Authentication check failed');

		if (!success || !user) {
			toast.error('Access denied. Please log in to continue.');
			await goto('/welcome');
			return;
		}

		isAuthenticated = true;
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

<style>
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
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>