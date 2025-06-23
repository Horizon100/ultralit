<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { createEventDispatcher, onMount } from 'svelte';
	import type { NotificationType, TaskNotification } from '$lib/types/types.notifications';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// Props
	export let notifications: TaskNotification[] = [];
	export let autoCloseDelay = 5000;

	const dispatch = createEventDispatcher();

	function removeNotification(id: string) {
		notifications = notifications.filter((n) => n.id !== id);
		dispatch('remove', id);
	}

	$: {
		notifications.forEach((notification) => {
			if (notification.autoClose !== false) {
				const timerId = setTimeout(() => {
					removeNotification(notification.id);
				}, autoCloseDelay);

				return () => clearTimeout(timerId);
			}
		});
	}
	function handleLinkClick(notification: TaskNotification) {
		dispatch('linkClick', notification);
		if (notification.autoClose !== false) {
			removeNotification(notification.id);
		}
	}
</script>

<div class="notification-container">
	{#each notifications as notification (notification.id)}
		<div
			class="notification {notification.type}"
			in:fly={{ y: 50, duration: 300 }}
			out:fade={{ duration: 200 }}
		>
			<div class="icon">
				{#if notification.type === 'loading'}
					<span class="spinner">
						{@html getIcon('RefreshCcw', { size: 18 })}
					</span>
				{:else if notification.type === 'success'}
					{@html getIcon('CheckCircle', { size: 18 })}
				{:else if notification.type === 'error'}
					{@html getIcon('AlertCircle', { size: 18 })}
				{/if}
			</div>

			<div class="content">
				<div class="message">{notification.message}</div>

				{#if notification.link}
					<button class="link-button" on:click={() => handleLinkClick(notification)}>
						{@html getIcon('File', { size: 14 })}
						{notification.link.text}
					</button>
				{/if}
			</div>

			<button
				class="close-button"
				on:click={() => removeNotification(notification.id)}
				aria-label="Close notification"
			>
				{@html getIcon('X', { size: 16 })}
			</button>
		</div>
	{/each}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.notification-container {
		position: fixed;
		bottom: 20px;
		right: 20px;
		display: flex;
		flex-direction: column-reverse;
		gap: 8px;
		z-index: 9999;
		pointer-events: none;
	}

	.notification {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-radius: 8px;
		background-color: #ffffff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		width: 300px;
		max-width: 90vw;
		pointer-events: auto;
		position: relative;
	}

	.notification.loading {
		border-left: 4px solid #3498db;
	}

	.notification.success {
		border-left: 4px solid #2ecc71;
	}

	.notification.error {
		border-left: 4px solid #e74c3c;
	}

	.icon {
		margin-right: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		animation: spin 1.5s linear infinite;
	}

	.content {
		flex: 1;
		margin-right: 8px;
	}

	.message {
		font-size: 14px;
		color: #333;
		margin-bottom: 4px;
	}

	.link-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		padding: 4px 0;
		font-size: 12px;
		color: #3498db;
		cursor: pointer;
		text-decoration: none;
	}

	.link-button:hover {
		color: #2980b9;
		text-decoration: underline;
	}

	.close-button {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: #999;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s;
	}

	.close-button:hover {
		color: #555;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Adjust for tablets/phones */
	@media (max-width: 768px) {
		.notification {
			width: 280px;
		}
	}
</style>
