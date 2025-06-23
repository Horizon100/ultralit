<script lang="ts">
	import { createEventDispatcher } from 'svelte';

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
			{maxLength}
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
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
			</svg>
		</button>
	</div>
	{#if maxLength}
		<div class="character-count" class:warning={value.length > maxLength * 0.9}>
			{value.length}/{maxLength}
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-input-container {
		padding: 16px;
		background: var(--bg-color);
		border-top: 1px solid var(--line-color);
	}

	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		background: var(--primary-color);
		border-radius: 24px;
		padding: 8px 12px;
		border: 1px solid var(--line-color);
		transition: border-color 0.2s ease;

		&:focus-within {
			border-color: var(--tertiary-color);
		}
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
		overflow-y: auto;
		padding: 8px 0;

		&::placeholder {
			color: var(--placeholder-color);
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.send-button {
		background: var(--secondary-color);
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
			background: var(--tertiary-color);
			color: var(--primary-color);
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