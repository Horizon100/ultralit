<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { DMConversation, DMMessage, User } from '$lib/types/types';
    import { currentUser } from '$lib/pocketbase';
	import DMChat from '$lib/features/dm/components/DMChat.svelte';
	import DMChatDrawer from '$lib/features/dm/components/DMDrawer.svelte';

	// Props
	export let user: User | null = null;
	export let initialConversationId: string | null = null;
	export let height = '100vh';
	export let showDrawerToggle = true;

	// State
	let conversations: DMConversation[] = [];
	let selectedConversation: DMConversation | null = null;
	let messages: DMMessage[] = [];
	let isDrawerOpen = true;
	let loading = false;
	let error = '';

	// Get user from page data if not provided

	onMount(() => {
		if (currentUser) {
			loadConversations();
		}

		// Set initial conversation if provided
		if (initialConversationId) {
			selectConversationById(initialConversationId);
		}
	});

	// Watch for conversation changes
	$: if (initialConversationId && conversations.length > 0) {
		selectConversationById(initialConversationId);
	}

	async function loadConversations() {
		if (!currentUser) return;

		try {
			loading = true;
			error = '';

			const response = await fetch('/api/dm/conversations');
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load conversations');
			}

			conversations = result.conversations.map((conv: any) => ({
				...conv,
				lastMessage: conv.lastMessage ? {
					...conv.lastMessage,
					timestamp: new Date(conv.lastMessage.timestamp)
				} : undefined
			}));

			// Mark active conversation
			if (initialConversationId) {
				conversations = conversations.map(conv => ({
					...conv,
					isActive: conv.id === initialConversationId
				}));
			}

		} catch (err) {
			console.error('Error loading conversations:', err);
			error = err instanceof Error ? err.message : 'Failed to load conversations';
		} finally {
			loading = false;
		}
	}

	async function loadMessages(partnerId: string) {
		if (!currentUser) return;

		try {
			loading = true;
			error = '';

			const response = await fetch(`/api/dm?receiverId=${partnerId}&perPage=100`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load messages');
			}

			messages = result.messages.map((msg: any) => ({
				...msg,
				created: msg.created,
				updated: msg.updated
			}));

		} catch (err) {
			console.error('Error loading messages:', err);
			error = err instanceof Error ? err.message : 'Failed to load messages';
		} finally {
			loading = false;
		}
	}

	function selectConversationById(convId: string) {
		const conversation = conversations.find(conv => conv.id === convId);
		if (conversation) {
			selectedConversation = conversation;
			loadMessages(conversation.user.id);
			
			// Update active state
			conversations = conversations.map(conv => ({
				...conv,
				isActive: conv.id === convId
			}));
		}
	}

	function handleSelectChat(event: CustomEvent<{ conversationId: string }>) {
		const convId = event.detail.conversationId;
		selectConversationById(convId);
	}

	function handleNewChat() {
		// Emit event to parent component to handle new chat creation
		const customEvent = new CustomEvent('newChat', {
			detail: {},
			bubbles: true
		});
		document.dispatchEvent(customEvent);
		console.log('New chat requested');
	}

	function handleSearch(event: CustomEvent<{ query: string }>) {
		const query = event.detail.query;
		console.log('Search query:', query);
	}

	async function handleSendMessage(message: string) {
		if (!selectedConversation || !currentUser) return;

		try {
			const response = await fetch('/api/dm', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: message,
					receiverId: selectedConversation.user.id
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to send message');
			}

			// Add the new message to the current messages
			messages = [...messages, result.message];

			// Update the conversation's last message
			const updatedConversations = conversations.map(conv => {
				if (conv.id === selectedConversation!.id) {
					return {
						...conv,
						lastMessage: {
							content: message,
							timestamp: new Date(),
							senderId: currentUser.id
						}
					};
				}
				return conv;
			});

			conversations = updatedConversations;

		} catch (err) {
			console.error('Error sending message:', err);
			error = err instanceof Error ? err.message : 'Failed to send message';
		}
	}

	function handleMarkAsRead(messageIds: string[]) {
		// Implement mark as read functionality
		console.log('Mark as read:', messageIds);
	}

	function toggleDrawer() {
		isDrawerOpen = !isDrawerOpen;
	}

	// Public API - expose functions for parent components
	export function openConversation(conversationId: string) {
		selectConversationById(conversationId);
	}

	export function startNewConversation(userId: string) {
		// Create or find conversation with specific user
		const existingConv = conversations.find(conv => conv.user.id === userId);
		if (existingConv) {
			selectConversationById(existingConv.id);
		} else {
			// This would create a new conversation
			console.log('Starting new conversation with user:', userId);
		}
	}

	export function refresh() {
		loadConversations();
	}
</script>

{#if !currentUser}
	<div class="dm-error">
		<p>User authentication required</p>
	</div>
{:else}
	<div class="dm-module" style="height: {height}">
		{#if error}
			<div class="error-banner">
				<span>{error}</span>
				<button on:click={() => error = ''}>×</button>
			</div>
		{/if}

		<div class="dm-layout">
			<DMChatDrawer
				{conversations}
				currentUserId={currentUser.id}
				isOpen={isDrawerOpen}
				on:selectChat={handleSelectChat}
				on:newChat={handleNewChat}
				on:search={handleSearch}
			/>

			<div class="chat-area" class:expanded={!isDrawerOpen}>
				{#if !isDrawerOpen && showDrawerToggle}
					<button class="drawer-toggle" on:click={toggleDrawer}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				{/if}

				{#if selectedConversation}
					<DMChat
						user={selectedConversation.user}
						{messages}
						currentUserId={currentUser.id}
						onSendMessage={handleSendMessage}
						onMarkAsRead={handleMarkAsRead}
					/>
				{:else}
					<div class="no-conversation">
						<div class="no-conversation-content">
							<div class="no-conversation-icon">💬</div>
							<h2>Select a conversation</h2>
							<p>Choose a conversation from the sidebar to start messaging</p>
							{#if conversations.length === 0 && !loading}
								<button class="start-chat-btn" on:click={handleNewChat}>
									Start your first conversation
								</button>
							{/if}
						</div>
					</div>
				{/if}

				{#if loading}
					<div class="loading-overlay">
						<div class="loading-spinner"></div>
					</div>
				{/if}
			</div>

			{#if isDrawerOpen && showDrawerToggle}
				<button class="drawer-close" on:click={toggleDrawer}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-module {
		background: var(--bg-color);
		position: relative;
		overflow: hidden;
        display: flex;
        justify-content: center;
        width: auto;
        flex: 1;
    }

	.dm-error {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--placeholder-color);
		background: var(--bg-color);
	}

	.error-banner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		background: #ef4444;
		color: white;
		padding: 12px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 1000;

		button {
			background: none;
			border: none;
			color: white;
			font-size: 18px;
			cursor: pointer;
			padding: 0 4px;
		}
	}

	.dm-layout {
		display: flex;

		height: 100%;
        width:100%;
        flex: 1;
        align-items: stretch;
        justify-content: flex-start;
		position: relative;
	}

	.chat-area {
		display: flex;
		flex-direction: row;
        background-color: orange;
		position: relative;
		height: 100%;
        width: auto;
        flex: 1;
        margin-left: 0;
        margin-right: 0;

		&.expanded {
			width: 100%;

		}
	}

	.drawer-toggle {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 100;
		background: var(--secondary-color);
		border: none;
		border-radius: 8px;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--tertiary-color);
			color: var(--primary-color);
		}
	}

	.drawer-close {
		position: absolute;
		top: 2rem;
		left: 190px;
		transform: translateY(-50%);
		background: var(--secondary-color);
		border: none;
		border-radius: 50%;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 10;

		&:hover {
			background: var(--tertiary-color);
			color: var(--primary-color);
		}
	}

	.no-conversation {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-gradient);
        width: 100% !important;
	}

	.no-conversation-content {
		text-align: center;
		width: 100% !important;

	}

	.no-conversation-icon {
		font-size: 64px;
		margin-bottom: 24px;
	}

	.no-conversation-content h2 {
		margin: 0 0 16px 0;
		color: var(--text-color);
		font-size: 24px;
		font-weight: 600;
	}

	.no-conversation-content p {
		margin: 0 0 32px 0;
		color: var(--placeholder-color);
		font-size: 16px;
		line-height: 1.5;
	}

	.start-chat-btn {
		background: var(--tertiary-color);
		color: var(--primary-color);
		border: none;
		border-radius: 24px;
		padding: 12px 24px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(80, 227, 194, 0.3);
		}
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--line-color);
		border-top: 3px solid var(--tertiary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	* {
		font-family: var(--font-family);
	}

	// Mobile responsive
	@media (max-width: 768px) {
		.dm-layout {
			position: relative;
		}

		:global(.dm-chat-drawer) {
			// position: absolute;
			top: 0;
			left: 0;
			height: 100%;
			z-index: 100;
		}

		.drawer-close {
			// display: none;
		}
	}
</style>