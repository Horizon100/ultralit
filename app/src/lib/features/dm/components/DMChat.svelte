<script lang="ts">
	import type {
		User,
		PublicUserProfile,
		UserProfile,
		DMMessage,
		ConversationUser
	} from '$lib/types/types';
	import DMHeader from './DMHeader.svelte';
	import DMInput from './DMInput.svelte';
	import { onMount, afterUpdate } from 'svelte';
	import { fly } from 'svelte/transition';

	export let user: User | PublicUserProfile | UserProfile | ConversationUser;
	export let showHeader: boolean = true;
	export let messages: DMMessage[] = [];
	export let currentUserId: string;
	export let loading = false;

	export let onSendMessage: (message: string) => Promise<void> | void;
	export let onMarkAsRead: ((messageIds: string[]) => void) | undefined = undefined;

	let messagesContainer: HTMLDivElement;
	let shouldScrollToBottom = true;

	onMount(() => {
		scrollToBottom();
	});

	afterUpdate(() => {
		if (shouldScrollToBottom) {
			scrollToBottom();
		}
	});

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function handleScroll() {
		if (messagesContainer) {
			const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
			shouldScrollToBottom = scrollTop + clientHeight >= scrollHeight - 10;
		}
	}

	async function handleSendMessage(event: CustomEvent<{ message: string }>) {
		const message = event.detail.message;
		shouldScrollToBottom = true;
		await onSendMessage(message);
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	function formatDate(date: Date): string {
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		} else {
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
			});
		}
	}

	function shouldShowDateSeparator(
		currentMessage: DMMessage,
		previousMessage: DMMessage | undefined
	): boolean {
		if (!previousMessage) return true;

		const currentDate = new Date(currentMessage.created);
		const previousDate = new Date(previousMessage.created);

		return currentDate.toDateString() !== previousDate.toDateString();
	}

	// Mark messages as read when they come into view
	$: if (messages.length && onMarkAsRead) {
		const unreadMessages = messages
			.filter((msg) => msg.senderId !== currentUserId)
			.map((msg) => msg.id);

		if (unreadMessages.length) {
			onMarkAsRead(unreadMessages);
		}
	}
</script>

<div class="dm-chat">
	{#if showHeader}
		<div class="chat-header">
			<DMHeader {user} showStatus={true} />
		</div>
	{/if}
	<div
		class="messages-container"
		class:no-header={!showHeader}
		bind:this={messagesContainer}
		on:scroll={handleScroll}
	>
		{#if loading && messages.length === 0}
			<div class="loading-overlay">
				<div class="loader-spinner"></div>
			</div>
		{:else if messages.length === 0}
			<div class="empty-state">
				<div class="empty-icon">💬</div>
				<p>Start a conversation with {user.name || user.username}</p>
			</div>
		{:else}
			{#each messages as message, index (message.id)}
				{#if shouldShowDateSeparator(message, messages[index - 1])}
					<div class="date-separator">
						<span>{formatDate(new Date(message.created))}</span>
					</div>
				{/if}

				<div
					class="message"
					class:own={message.senderId === currentUserId}
					class:other={message.senderId !== currentUserId}
				>
					<div class="message-content">
						<p>{message.content}</p>
						<div class="message-meta">
							<span class="timestamp">{formatTime(new Date(message.created))}</span>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="chat-input" in:fly={{ y: 200, duration: 300 }} out:fly={{ y: 200, duration: 200 }}>
		<DMInput
			placeholder="Message {user.name || user.username}..."
			on:send={handleSendMessage}
			maxLength={1000}
		/>
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
	}

	.chat-header {
		flex-shrink: 0;
		background: var(--primary-color);
		border-bottom: 1px solid var(--line-color);
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		backdrop-filter: blur(30px);
		&::-webkit-scrollbar {
			width: 8px;
		}

		&::-webkit-scrollbar-track {
			background: var(--primary-color);
		}

		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 4px;
		}
	}
	.messages-container.no-header {
		height: 100%;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: calc(100% - 2rem);
		color: var(--placeholder-color);
		text-align: center;

		.empty-icon {
			font-size: 48px;
			margin-bottom: 16px;
		}

		p {
			margin: 0;
			font-size: 16px;
		}
	}

	.date-separator {
		display: flex;
		align-items: center;
		margin: 24px 0 16px;

		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: var(--line-color);
		}

		span {
			padding: 0 16px;
			font-size: 12px;
			color: var(--placeholder-color);
			background: var(--bg-color);
			border-radius: 12px;
			white-space: nowrap;
		}
	}

	.message {
		margin-bottom: 8px;
		display: flex;

		&.own {
			justify-content: flex-end;

			.message-content {
				background: var(--tertiary-color);
				color: var(--primary-color);
				border-bottom-right-radius: 4px;
			}
		}

		&.other {
			justify-content: flex-start;

			.message-content {
				background: var(--secondary-color);
				color: var(--text-color);
				border-bottom-left-radius: 4px;
			}
		}
	}

	.message-content {
		max-width: 70%;
		padding: 12px 16px;
		border-radius: 18px;
		word-wrap: break-word;

		p {
			margin: 0 0 4px 0;
			line-height: 1.4;
		}
	}

	.message-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: flex-end;
	}

	.timestamp {
		font-size: 11px;
		opacity: 0.7;
	}

	.status {
		font-size: 12px;
		opacity: 0.7;

		&.sending {
			opacity: 0.5;
		}

		&.read {
			color: var(--tertiary-color);
			opacity: 1;
		}
	}

	.chat-input {
		flex-shrink: 0;
		background: var(--primary-color);
	}

	* {
		font-family: var(--font-family);
	}
</style>
