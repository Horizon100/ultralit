<script lang="ts">
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-svelte';
	import { scale } from 'svelte/transition';

	// Define providers with validation functions
	import { openAI } from './validation/validateOpenAI';
	import { anthropic } from './validation/validateAnthropic';
	import { google } from './validation/validateGoogle';
	import { grok } from './validation/validateGrok';

	// Modular providers object
	const providers = {
		openai: openAI,
		anthropic: anthropic,
		google: google,
		grok: grok
	} as const;

	type Provider = keyof typeof providers;

	let activeProvider: Provider = 'openai';
	let inputKey = '';
	let showKey = false;
	let isVerifying = false;
	let isValid = false;
	let error = '';

	let passwordInput: HTMLInputElement;
	let textInput: HTMLInputElement;

	// Watch for changes in the apiKey store
	$: inputKey = apiKey[activeProvider] || ''; // This will update when apiKey store is updated

	function updateValue(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		inputKey = value;
	}

	function setActiveProvider(id: string) {
		activeProvider = id as Provider;
		inputKey = apiKey[activeProvider] || ''; // Reset the input key when switching providers
		isValid = false;
		error = '';
	}

	async function verifyAndSaveKey(e: Event) {
		e.preventDefault();
		isVerifying = true;
		error = '';
		isValid = false;

		console.log('Verifying key:', inputKey); // Log the input key before validation

		try {
			const validationResponse = await providers[activeProvider](inputKey);
			if (validationResponse) {
				console.log('Validation successful');
				await apiKey.setKey(activeProvider, inputKey); // Save the key
				isValid = true;
			} else {
				console.log('Validation failed');
				error = `Invalid API key for ${activeProvider}`;
			}
		} catch (err) {
			error = `Verification failed: ${(err as Error).message}`;
		} finally {
			isVerifying = false;
		}
	}
</script>

<form class="api-key-input" on:submit={verifyAndSaveKey} transition:scale>
	<div class="header">
		<div class="provider-tabs">
			{#each Object.entries(providers) as [id, provider]}
				<button
					type="button"
					class="provider-tab"
					class:active={activeProvider === id}
					on:click={() => setActiveProvider(id)}
				>
					{provider.name || id}
					<!-- Display name of the provider (can be customized) -->
				</button>
			{/each}
		</div>
	</div>

	<div class="input-container">
		{#if showKey}
			<input
				bind:this={textInput}
				type="text"
				placeholder={providers[activeProvider].prefix + '...'}
				value={inputKey}
				on:input={updateValue}
			/>
		{:else}
			<input
				bind:this={passwordInput}
				type="password"
				placeholder={providers[activeProvider].prefix + '...'}
				value={inputKey}
				on:input={updateValue}
			/>
		{/if}

		<button type="button" class="toggle-visibility" on:click={() => (showKey = !showKey)}>
			<svelte:component this={showKey ? EyeOff : Eye} size={20} />
		</button>
	</div>

	{#if error}
		<div class="error" transition:scale>
			<XCircle size={16} />
			{error}
		</div>
	{/if}

	<button type="submit" class="verify-button" disabled={isVerifying || !inputKey}>
		{#if isVerifying}
			Verifying...
		{:else if isValid}
			<CheckCircle size={16} /> API Key Saved
		{:else}
			Save API Key
		{/if}
	</button>
</form>

<style>
	.api-key-input {
		background: var(--background-light);
		padding: 0;
		border-radius: 1rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-width: 500px;
		width: 100%;
		z-index: 2000;
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		color: var(--text-color);
	}

	.input-container {
		position: relative;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		padding-right: 3rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		font-size: 1rem;
		background: var(--background);
		color: var(--text-color);
	}

	input:focus {
		outline: none;
		border-color: var(--primary-color);
		box-shadow: 0 0 0 2px var(--primary-color-transparent);
	}

	.toggle-visibility {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		padding: 0.5rem;
		border-radius: 0.25rem;
	}

	.toggle-visibility:hover {
		color: var(--text-color);
		background: var(--background-hover);
	}

	.verify-button {
		width: 100%;
		padding: 0.75rem;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: background-color 0.2s;
	}

	.verify-button:hover:not(:disabled) {
		background: var(--primary-color-dark);
	}

	.verify-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error {
		color: var(--error-color);
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: var(--error-background);
	}

	.info {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.info p {
		margin-bottom: 0.5rem;
	}

	.info a {
		color: var(--primary-color);
		text-decoration: none;
	}

	.info a:hover {
		text-decoration: underline;
	}

	.provider-tabs {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		margin-left: 1rem;
	}

	.provider-tab {
		padding: 0.5rem 1rem;
		background: var(--secondary-color);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		cursor: pointer;

		&.active {
			background: var(--primary-color);
			color: white;
		}
	}

	.provider-select {
		display: flex;
		gap: 0.5rem;
		margin-left: 1rem;
	}

	.provider-button {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background: var(--background);
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s;

		&.active {
			background: var(--primary-color);
			color: white;
			border-color: var(--primary-color);
		}

		&:hover:not(.active) {
			background: var(--background-hover);
		}
	}
</style>
