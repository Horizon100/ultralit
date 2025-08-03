<script lang="ts">
	import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { t } from '$lib/stores/translationStore';
	import type { User } from '$lib/types/types';
	import MessageProcessor from '$lib/features/ai/components/chat/MessageProcessor.svelte';
	import RecursiveMessage from '$lib/features/ai/components/chat/RecursiveMessage.svelte';
	import { DateUtils } from '$lib/utils/dateUtils';
	import { formatDate } from '$lib/utils/formatters';
	import { useScrollManagement } from '$lib/composables/useScrollManagement';
	import { MessageService } from '$lib/services/messageService';
	import type { InternalChatMessage, AIModel, PromptType } from '$lib/types/types';

	// Props
	export let chatMessages: InternalChatMessage[] = [];
	export let isLoadingMessages = false;
	export let isTypingInProgress = false;
	export let userId: string;
	export let name: string;
	export let aiModel: AIModel;
	export let promptType: PromptType;
	export let latestMessageId: string | null = null;
	export let hiddenReplies: Set<string> = new Set();

	// DOM references
	let chatMessagesDiv: HTMLDivElement;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Scroll management
	const { setupScrollObserver, scrollToBottom, handleNewMessage } = useScrollManagement();

	// Computed values
	$: groupedMessages = DateUtils.groupMessagesByDate(chatMessages);

	// Event handlers

	function toggleReplies(messageId: string): void {
		dispatch('toggleReplies', { messageId });
	}

	function replyToMessage(
		text: string,
		parentMsgId?: string,
		contextMessages?:
			| Partial<InternalChatMessage>[]
			| { role: string; content: string; model?: string }[]
	): Promise<void> {
		dispatch('replyToMessage', { text, parentMsgId, contextMessages });
		return Promise.resolve();
	}

	// Lifecycle
	onMount(() => {
		if (chatMessagesDiv) {
			const cleanup = setupScrollObserver(chatMessagesDiv);
			return cleanup;
		}
	});

	afterUpdate(() => {
		if (chatMessagesDiv && chatMessages.length > 0) {
			// Auto-scroll to bottom for new messages
			const lastMessage = chatMessages[chatMessages.length - 1];
			if (lastMessage && lastMessage.role === 'user') {
				setTimeout(() => scrollToBottom(chatMessagesDiv), 100);
			}
		}
	});

	// Export the container reference for parent components
	export { chatMessagesDiv };
</script>

{#if isLoadingMessages}
	<div class="spinner-overlay">
		<div class="spinner"></div>
		<p>{$t('chat.loading')}</p>
	</div>
{:else}
	<!-- Message Processor (outside of chat messages for global processing) -->
	{#if !isTypingInProgress}
		<MessageProcessor messages={chatMessages} />
	{/if}

	<!-- Chat Messages Container -->
	<div
		class="chat-messages"
		bind:this={chatMessagesDiv}
		transition:fly={{ x: -300, duration: 300 }}
	>
		{#each groupedMessages as { date, messages }}
			<div class="date-divider">
				{formatDate(date)}
			</div>

			{#each messages as message (message.id)}
				{#if !message.parent_msg || !chatMessages.some((m) => m.id === message.parent_msg)}
					<RecursiveMessage
						{message}
						allMessages={chatMessages}
						{userId}
						{name}
						{latestMessageId}
						{toggleReplies}
						{hiddenReplies}
						sendMessage={replyToMessage}
						{aiModel}
						{promptType}
					/>
				{/if}
			{/each}
		{/each}
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	:root {
		--h3-min-size: 0.875rem;
		--h3-max-size: 1.125rem;
		--breakpoint-sm: #{$breakpoint-sm};
		--breakpoint-md: #{$breakpoint-md};
		--breakpoint-lg: #{$breakpoint-lg};
		--breakpoint-xl: #{$breakpoint-xl};
	}
	.drawer-visible .chat-messages {
		border-bottom: 1px solid transparent;
		width: 100%;
		height: auto;
		justify-content: flex-start !important;
		align-items: flex-start !important;
	}

	.chat-messages {
		flex-grow: 0;
		overflow-x: hidden;
		display: flex;
		position: relative;
		gap: 1rem;
		margin-bottom: 2rem;
		// border: 1px solid var(--line-color);
		// border-bottom: 1px solid transparent;
		border-radius: 2rem 2rem 0 0;
		margin-top: 0;
		padding: 0;
		flex-direction: column;
		justify-content: flex-start;
		align-items: stretch;
		height: 100%;
		max-height: 79vh;
		width: 100%;
		max-width: 1200px;
		// scrollbar-width: 2px;
		// scrollbar-color: var(--secondary-color) transparent;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
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
		background: linear-gradient
			(
				90deg,
				rgba(117, 118, 114, 0.9) 0%,
				rgba(0, 0, 0, 0.85) 5%,
				rgba(117, 118, 114, 0.8) 10%,
				rgba(117, 118, 114, 0.75) 15%,
				rgba(117, 118, 114, 0.7) 20%,
				rgba(0, 0, 0, 0.65) 25%,
				rgba(117, 118, 114, 0.6) 30%,
				rgba(0, 0, 0, 0.55) 35%,
				rgba(0, 0, 0, 0.5) 40%,
				rgba(117, 118, 114, 0.45) 45%,
				rgba(0, 0, 0, 0.4) 50%,
				rgba(0, 0, 0, 0.35) 55%,
				rgba(117, 118, 114, 0.3) 60%,
				rgba(117, 118, 114, 0.25) 65%,
				rgba(117, 118, 114, 0.2) 70%,
				rgba(117, 118, 114, 0.15) 75%,
				rgba(0, 0, 0, 0.1) 80%,
				rgba(1, 1, 1, 0.05) 85%,
				rgba(117, 118, 114, 0) 100%
			);
		&::before {
			display: flex;
			flex-direction: column;

			/* top: 0;
      background: linear-gradient(
        to bottom, 
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
        
      );
      backdrop-filter: blur(3px);
      height: 20px; */
		}
		&::after {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			height: 30px;
			width: 100%;
			pointer-events: none;
			/* bottom: 90px;
      background: linear-gradient(
        to top,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
      );
      backdrop-filter: blur(5px);
      z-index: 1;*/
		}
		&::-webkit-scrollbar {
			width: 10px;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: #888;
			border-radius: 5px;
		}
	}
	.spinner-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		gap: 1rem;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(var(--text-color-rgb), 0.1);
		border-top: 3px solid rgb(var(--text-color-rgb));
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.date-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 1rem 0;
		font-size: 0.875rem;
		color: rgba(var(--text-color-rgb), 0.6);
		position: relative;
	}

	.date-divider::before {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(var(--text-color-rgb), 0.1);
		margin-right: 1rem;
	}

	.date-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(var(--text-color-rgb), 0.1);
		margin-left: 1rem;
	}
</style>
