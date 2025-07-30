<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fade, fly } from 'svelte/transition';
	import { createEventDispatcher, onMount } from 'svelte';
	import type { NotificationType, IdeNotification } from '$lib/types/types.notifications';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// Props
	export let notifications: IdeNotification[] = [];
	export let autoCloseDelay = 4000; // Default to 4 seconds for IDE notifications
	export let position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';

	const dispatch = createEventDispatcher();

	// Function to remove a notification
	function removeNotification(id: string) {
		notifications = notifications.filter((n) => n.id !== id);
		dispatch('remove', id);
	}

	// Auto-close notifications after specified delay
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

	// Handle action button click
	function handleActionClick(notification: IdeNotification) {
		if (notification.action?.onClick) {
			notification.action.onClick();
		}

		if (notification.autoClose !== false) {
			removeNotification(notification.id);
		}
	}

	// Map position to CSS classes
	$: containerClass = {
		'bottom-right': 'bottom-right',
		'bottom-left': 'bottom-left',
		'top-right': 'top-right',
		'top-left': 'top-left'
	}[position];

	// Map notification type to icon color
	function getIconColor(type: NotificationType): string {
		switch (type) {
			case 'loading':
				return '#3498db';
			case 'success':
				return '#2ecc71';
			case 'error':
				return '#e74c3c';
			case 'info':
				return '#f39c12';
			default:
				return '#3498db';
		}
	}
</script>

<div class="notification-container {containerClass}">
	{#each notifications as notification (notification.id)}
		<div
			class="notification {notification.type}"
			in:fly={{ y: position.startsWith('top') ? -50 : 50, duration: 300 }}
			out:fade={{ duration: 200 }}
		>
			<div class="icon" style="color: {getIconColor(notification.type)}">
				{#if notification.type === 'loading'}
					<span class="spinner">
						<Icon name="RefreshCcw" size={18} />
					</span>
				{:else if notification.type === 'success'}
					<Icon name="CheckCircle" size={18} />
				{:else if notification.type === 'error'}
					<Icon name="AlertCircle" size={18} />
				{:else if notification.type === 'info'}
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="16" x2="12" y2="12"></line>
						<line x1="12" y1="8" x2="12.01" y2="8"></line>
					</svg>
				{/if}
			</div>

			<div class="content">
				<div class="message">{notification.message}</div>

				{#if notification.action}
					<button class="action-button" on:click={() => handleActionClick(notification)}>
						{#if notification.action.icon}
							<svelte:component this={notification.action.icon} size={14} />
						{/if}
						{notification.action.label}
					</button>
				{/if}
			</div>

			<button
				class="close-button"
				on:click={() => removeNotification(notification.id)}
				aria-label="Close notification"
			>
				<Icon name="X" size={16} />
			</button>
		</div>
	{/each}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.notification-container {
		position: fixed;
		display: flex;
		gap: 8px;
		z-index: 9999;
		pointer-events: none; /* Container doesn't block clicks */
		max-width: 100%;
	}

	.bottom-right {
		bottom: 20px;
		right: 20px;
		flex-direction: column-reverse; /* Stack newest on bottom */
	}

	.bottom-left {
		bottom: 20px;
		left: 20px;
		flex-direction: column-reverse;
	}

	.top-right {
		top: 20px;
		right: 20px;
		flex-direction: column;
	}

	.top-left {
		top: 20px;
		left: 20px;
		flex-direction: column;
	}

	.notification {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-radius: 6px;
		background-color: #ffffff;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
		width: 320px;
		max-width: 90vw;
		pointer-events: auto; /* Allow interaction with notification */
		position: relative;
		border-left: 3px solid transparent;
	}

	.notification.loading {
		border-left-color: #3498db;
	}

	.notification.success {
		border-left-color: #2ecc71;
	}

	.notification.error {
		border-left-color: #e74c3c;
	}

	.notification.info {
		border-left-color: #f39c12;
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

	.action-button {
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

	.action-button:hover {
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

	/* Dark theme support */
	:global(.dark-theme) .notification {
		background-color: #2a2a2a;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
	}

	:global(.dark-theme) .message {
		color: #eee;
	}

	:global(.dark-theme) .close-button {
		color: #888;
	}

	:global(.dark-theme) .close-button:hover {
		color: #bbb;
	}

	:global(.dark-theme) .action-button {
		color: #5dade2;
	}

	:global(.dark-theme) .action-button:hover {
		color: #7fb3d5;
	}
</style>
