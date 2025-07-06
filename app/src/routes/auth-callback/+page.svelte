<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/pocketbase';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import PocketBase from 'pocketbase';
	import type { User } from '$lib/types/types';

	let loading = true;
	let error: string | null = null;
	let debugInfo = {};

	onMount(async () => {
		try {
			// Get URL parameters
			const params = new URLSearchParams(window.location.search);
			const code = params.get('code');
			const state = params.get('state');

			// Save for debugging
			debugInfo = {
				code: code ? 'present' : 'missing',
				state: state ? 'present' : 'missing',
				fullUrl: window.location.href
			};

			console.log('Auth callback params:', debugInfo);

			if (!code || !state) {
				throw new Error('Missing authentication parameters');
			}

			// Get the correct redirect URL based on environment
			const isLocalDev =
				window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

			const redirectUrl = isLocalDev
				? 'http://localhost:5173/auth-callback'
				: 'https://vrazum.com/auth-callback';

			// Create a PocketBase instance
			const pb = new PocketBase(get(pocketbaseUrl));

			// Complete the OAuth flow
			const authData = await pb.collection('users').authWithOAuth2Code(
				'google',
				code,
				state,
				redirectUrl // Use our domain-based redirect URL here
			);

			console.log('Auth successful:', authData);

			// Update the currentUser store
			if (authData && authData.record) {
				currentUser.set(authData.record as User);

				// Now call the server to sync the session there
				await fetch('/api/verify/auth-check', {
					method: 'GET',
					credentials: 'include'
				});

				// Redirect to dashboard
				setTimeout(() => goto('/dashboard'), 500);
			} else {
				throw new Error('Failed to get user data from authentication');
			}
		} catch (err) {
			console.error('Auth callback error:', err);
			error = err instanceof Error ? err.message : 'Authentication failed';
			setTimeout(() => goto('/login?error=' + encodeURIComponent(String(error))), 2000);
		} finally {
			loading = false;
		}
	});
</script>

<div class="auth-callback-container">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Completing authentication...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>Authentication failed: {error}</p>
			<p>Redirecting to login page...</p>
			<details>
				<summary>Debug Information</summary>
				<pre>{JSON.stringify(debugInfo, null, 2)}</pre>
			</details>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.auth-callback-container {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		width: 100%;
		text-align: center;
	}

	.loading,
	.error {
		padding: 2rem;
		max-width: 400px;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		border-top: 4px solid #3498db;
		width: 30px;
		height: 30px;
		margin: 0 auto 1rem;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	details {
		margin-top: 1rem;
		text-align: left;
	}

	pre {
		background: #f5f5f5;
		padding: 0.5rem;
		border-radius: 0.25rem;
		overflow-x: auto;
	}
</style>
