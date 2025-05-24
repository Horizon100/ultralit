<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Loader2 } from 'lucide-svelte';
	import { t } from '$lib/stores/translationStore';

	let newPassword: string = '';
	let confirmPassword: string = '';
	let isLoading: boolean = false;
	let isSuccess: boolean = false;
	let errorMessage: string = '';

	// Get token from URL parameters
	$: token = $page.params.token;

	async function handleResetPassword() {
		if (!token) {
			errorMessage = 'Invalid or missing reset token';
			return;
		}

		if (newPassword !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			return;
		}

		if (newPassword.length < 8) {
			errorMessage = 'Password must be at least 8 characters';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/auth/confirm-reset', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token,
					password: newPassword,
					passwordConfirm: confirmPassword
				})
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error || 'Password reset failed');
			}

			isSuccess = true;

			// Redirect to home after 3 seconds
			setTimeout(() => {
				goto('/');
			}, 3000);
		} catch (error) {
			console.error('Password reset error:', error);
			errorMessage =
				error instanceof Error ? error.message : 'An error occurred during password reset';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="reset-password-container">
	<h1>{$t('profile.resetPassword')}</h1>

	{#if isSuccess}
		<div class="success-message">
			<p>{$t('profile.passwordResetSuccess')}</p>
			<p>{$t('profile.redirectingToHome')}</p>
		</div>
	{:else}
		<form on:submit|preventDefault={handleResetPassword}>
			<div class="form-group">
				<label for="newPassword">{$t('profile.newPassword')}</label>
				<input
					type="password"
					id="newPassword"
					bind:value={newPassword}
					required
					disabled={isLoading}
				/>
			</div>

			<div class="form-group">
				<label for="confirmPassword">{$t('profile.confirmPassword')}</label>
				<input
					type="password"
					id="confirmPassword"
					bind:value={confirmPassword}
					required
					disabled={isLoading}
				/>
			</div>

			{#if errorMessage}
				<p class="error-message">{errorMessage}</p>
			{/if}

			<button type="submit" class="reset-button" disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="animate-spin" />
				{:else}
					{$t('profile.resetPassword')}
				{/if}
			</button>
		</form>
	{/if}
</div>

<style>
	.reset-password-container {
		max-width: 400px;
		margin: 2rem auto;
		padding: 2rem;
		background-color: var(--card-bg);
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	h1 {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background-color: var(--input-bg);
		color: var(--text-color);
	}

	.reset-button {
		width: 100%;
		padding: 0.75rem;
		margin-top: 1rem;
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
	}

	.reset-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-message {
		color: var(--error-color);
		margin: 0.5rem 0;
	}

	.success-message {
		text-align: center;
		color: var(--success-color);
	}
</style>
