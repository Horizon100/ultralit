<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import { X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { providers } from '$lib/features/ai/utils/providers';
	import { modelStore } from '$lib/stores/modelStore';
	import { currentUser } from '$lib/pocketbase';

	export let provider: string;

	const dispatch = createEventDispatcher<{
		submit: string;
		close: void;
	}>();

	let key = '';

	function getProviderName(): string {
		return (providers as any)[provider]?.name || provider;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (key.trim()) {
			dispatch('submit', key.trim());
			key = '';
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('form')) {
			dispatch('close');
		}
	}
</script>

<div class="overlay" on:click={handleClickOutside} transition:fly={{ y: -20, duration: 200 }}>
	<form on:submit={handleSubmit} transition:fly={{ y: 20, duration: 200 }}>
		<div class="input-wrapper">
			<input
				type="password"
				bind:value={key}
				placeholder="Enter API key for {getProviderName()}"
				autofocus
			/>
		</div>

		<button type="submit" class="submit-button"> Save Key </button>
	</form>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.overlay {
		bottom: 200px;
		z-index: 3000;
		width: 400px;
	}
	.input-wrapper {
		position: relative;
		width: auto;
	}

	input {
		width: 100%;
		padding: 1.5rem;
		padding-right: 3rem;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		font-size: 1rem;
		background: transparent;
		color: var(--text-color);

		/* Make the password reveal icon white */
		&::-ms-reveal {
			filter: invert(100%) brightness(200%) contrast(100%);
			margin-right: 2rem; /* Move the icon left */
			position: relative;
			right: 2rem;
		}

		&::-webkit-credentials-auto-fill-button {
			filter: invert(100%) brightness(200%) contrast(100%);
			margin-right: 2rem; /* Move the icon left */
			position: relative;
			right: 2rem;
		}
	}

	/* Global styles for password reveal icon across browsers */
	:global(input[type='password']::-ms-reveal),
	:global(input[type='password']::-webkit-credentials-auto-fill-button) {
		filter: invert(100%) brightness(200%) contrast(100%);
		margin-right: 12px;
	}

	input::placeholder {
		font-size: 1.2rem;
		color: var(--placeholder-color);
		width: 90%;
		font-style: italic;
	}

	input:focus {
		outline: none;
		border-color: var(--primary-color);
		box-shadow: 0 0 0 2px var(--primary-color-transparent);
		z-index: 1000;
		color: var(--text-color);
	}

	form {
		border: 1px solid var(--border-color);
		width: 100%;
		background: var(--bg-color);
	}

	button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		width: 100%;
		height: 60px;
		background: var(--bg-gradient);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;
		font-size: 1.2rem;

		&:hover {
			transform: translateY(-4px);
			background: var(--bg-gradient-r);
		}

		span {
			font-size: 0.9rem;
		}
	}

	/* Additional style to ensure password reveal icon is properly positioned */
	:global(input[type='password']::-ms-reveal) {
		filter: invert(1);
		margin-right: 8px;
	}

	:global(input[type='password']::-webkit-credentials-auto-fill-button) {
		filter: invert(1);
		margin-right: 8px;
	}
</style>
