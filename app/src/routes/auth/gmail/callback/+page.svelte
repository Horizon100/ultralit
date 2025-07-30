<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let authCode = '';
	let error = '';
	let copied = false;

	onMount(() => {
		const urlParams = $page.url.searchParams;
		authCode = urlParams.get('code') || '';
		error = urlParams.get('error') || '';

		if (error) {
			console.error('OAuth error:', error);
		}
	});

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(authCode);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function goToEmailSetup() {
		// Navigate back to your profile/email setup
		goto('/profile?tab=email');
	}
</script>

<div class="callback-container">
	<div class="callback-card">
		<h1>Gmail Authorization</h1>

		{#if error}
			<div class="error">
				<h2>Authorization Failed</h2>
				<p>Error: {error}</p>
				<button on:click={goToEmailSetup} class="btn-primary"> Back to Email Setup </button>
			</div>
		{:else if authCode}
			<div class="success">
				<h2>✅ Authorization Successful!</h2>
				<p>Copy this authorization code and paste it in the email setup form:</p>

				<div class="code-container">
					<input type="text" value={authCode} readonly class="code-input" />
					<button on:click={copyCode} class="copy-btn">
						{copied ? '✅ Copied!' : '📋 Copy'}
					</button>
				</div>

				<div class="instructions">
					<ol>
						<li>Copy the authorization code above</li>
						<li>Go back to the email setup form</li>
						<li>Paste the code in the "Authorization Code" field</li>
						<li>Click "Add Account"</li>
					</ol>
				</div>

				<button on:click={goToEmailSetup} class="btn-primary"> Back to Email Setup </button>
			</div>
		{:else}
			<div class="loading">
				<p>Processing authorization...</p>
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.callback-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-color);
		padding: 1rem;
	}

	.callback-card {
		background: var(--primary-color);
		box-shadow: var(--placeholder-color) 0 0 60px 1px;
		border-radius: 12px;
		padding: 2rem;
		max-width: 600px;
		width: 100%;
	}

	h1 {
		text-align: center;
		margin-bottom: 1.5rem;
		color: var(--text-color);
	}

	h2 {
		color: var(--text-color);
		margin-bottom: 1rem;
	}

	.error {
		text-align: center;
		color: #d32f2f;
	}

	.success {
		text-align: center;
		color: var(--tertiary-color);
	}

	.code-container {
		display: flex;
		gap: 0.5rem;
		margin: 1.5rem 0;
	}

	.code-input {
		flex: 1;
		padding: 0.75rem;
		border: 2px solid var(--line-color);
		border-radius: 6px;
		font-family: monospace;
		font-size: 0.9rem;
		color: var(--text-color);
		background: var(--secondary-color);
	}

	.copy-btn {
		padding: 0.75rem 1rem;
		background: var(--primary-color);
		color: var(--text-color);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		white-space: nowrap;
	}

	.copy-btn:hover {
		background: var(--tertiary-color);
	}

	.instructions {
		text-align: left;
		margin: 1.5rem 0;
		padding: 1rem;
		background: var(--bg-color);
		border-radius: 6px;
		border-left: 4px solid var(--tertiary-color);
	}

	.instructions ol {
		margin: 0;
		padding-left: 1.2rem;
	}

	.instructions li {
		margin-bottom: 0.5rem;
	}

	.btn-primary {
		background: var(--secondary-color);
		color: var(--text-color);
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
	}

	.btn-primary:hover {
		background: var(--tertiary-color);
	}

	.loading {
		text-align: center;
		color: #666;
	}
</style>
