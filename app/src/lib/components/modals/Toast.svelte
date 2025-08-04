<script lang="ts">
	import { toasts, dismissToast } from '$lib/utils/toastUtils';
	import { fly } from 'svelte/transition';

	const getToastClass = (type: string) => {
		switch (type) {
			case 'success':
				return 'toast-success';
			case 'error':
				return 'toast-error';
			case 'warning':
				return 'toast-warning';
			case 'info':
				return 'toast-info';
			default:
				return 'toast-default';
		}
	};
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<div
			class="toast {getToastClass(toast.type)}"
			role="alert"
			aria-live="assertive"
			in:fly={{ y: 20, duration: 200 }}
			out:fly={{ y: 20, duration: 200 }}
			on:click|stopPropagation={() => dismissToast(toast.id)}
			on:keydown|stopPropagation={(e) =>
				e.key === 'Enter' || e.key === ' ' ? dismissToast(toast.id) : null}
			tabindex="0"
		>
			<span>{toast.message}</span>
			<button
				class="toast-button"
				aria-label="Dismiss notification"
				on:click|stopPropagation={() => dismissToast(toast.id)}
			>
				×
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 4rem;
		right: 16px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 320px;
		max-width: 100%;
	}

	.toast {
		padding: 12px 16px;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		color: var(--text-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.toast-success {
		background-color: #4caf50;
	}
	.toast-error {
		background-color: #f44336;
	}
	.toast-warning {
		background-color: #ff9800;
	}
	.toast-info {
		background-color: #2196f3;
	}
	.toast-default {
		background-color: #607d8b;
	}

	.toast-button {
		background: none;
		border: none;
		color: inherit;
		font-size: 1.2em;
		margin-left: 8px;
		cursor: pointer;
		padding: 0 4px;
	}

	.toast-button:hover {
		opacity: 0.8;
	}
</style>
