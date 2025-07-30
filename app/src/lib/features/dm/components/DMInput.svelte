<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { getIcon } from '$lib/utils/lucideIcons';

	export let value = '';
	export let placeholder = 'Type a message...';
	export let disabled = false;
	export let maxLength: number | undefined = undefined;

	const dispatch = createEventDispatcher<{
		send: { message: string };
		input: { value: string };
	}>();

	let textareaElement: HTMLTextAreaElement;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function handleInput() {
		// Auto-resize textarea
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = textareaElement.scrollHeight + 'px';
		}
		dispatch('input', { value });
	}

	function sendMessage() {
		if (value.trim() && !disabled) {
			dispatch('send', { message: value.trim() });
			value = '';
			if (textareaElement) {
				textareaElement.style.height = 'auto';
			}
		}
	}
</script>

<div class="dm-input-container">
	<div class="input-wrapper">
		<textarea
			bind:this={textareaElement}
			bind:value
			{placeholder}
			{disabled}
			on:keydown={handleKeydown}
			on:input={handleInput}
			rows="1"
			class="message-input"
		/>
		<button
			type="button"
			class="send-button"
			{disabled}
			class:has-content={value.trim()}
			on:click={sendMessage}
		>
			<Icon name="Send" size={16} />
		</button>
	</div>
	{#if maxLength}
		<div class="character-count" class:warning={value.length > maxLength * 0.9}>
			{value.length}/{maxLength}
		</div>
	{/if}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;

	.dm-input-container {
		padding: 0.25rem 0.5rem;
		border: 1px solid transparent;
		border-top: 1px solid var(--line-color);
		transition: all 0.3s ease;
		opacity: 0.7;
		&:focus-within {
			box-shadow: 0 30px 140px 50px rgba(255, 255, 255, 0.22);
			opacity: 1;
			background: var(--bg-color);
		}
	}

	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 0.5rem;
		transition: border-color 0.2s ease;
	}

	.message-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-color);
		font-size: 14px;
		line-height: 1.4;
		resize: none;
		min-height: 20px;
		max-height: 120px;
		padding: 8px 0;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: auto;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
		&::placeholder {
			color: var(--placeholder-color);
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.send-button {
		background: transparent;
		border: none;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--placeholder-color);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;

		&:hover:not(:disabled) {
			background: var(--tertiary-color);
			color: var(--primary-color);
			transform: scale(1.05);
		}

		&.has-content {
			color: var(--tertiary-color);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			transform: none;
		}
	}

	.character-count {
		font-size: 12px;
		color: var(--placeholder-color);
		text-align: right;
		margin-top: 4px;

		&.warning {
			color: #ef4444;
		}
	}

	* {
		font-family: var(--font-family);
	}
</style>
