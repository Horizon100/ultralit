<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { DMConversation, DMMessage, User } from '$lib/types/types';
	import DMChat from '$lib/features/dm/components/DMChat.svelte';
	import DMChatDrawer from '$lib/features/dm/components/DMDrawer.svelte';

	export let data;

	let conversations: DMConversation[] = [];
	let selectedConversation: DMConversation | null = null;
	let messages: DMMessage[] = [];
	let isDrawerOpen = true;
	let loading = false;
	let error = '';

	// Get conversation ID from URL params
	$: conversationId = $page.url.searchParams.get('conversation');

	onMount(() => {
		loadConversations();
	});

	// Watch for conversation changes in URL
	$: if (conversationId && conversations.length > 0) {
		selectConversationById(conversationId);
	}

	async function loadConversations() {
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
			if (conversationId) {
				conversations = conversations.map(conv => ({
					...conv,
					isActive: conv.id === conversationId
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
		
		// Update URL
		const url = new URL($page.url);
		url.searchParams.set('conversation', convId);
		goto(url.toString(), { replaceState: true });
	}

	function handleNewChat() {
		// Navigate to user selection or create new chat logic
		console.log('New chat requested');
		// You could navigate to a user selection page or open a modal
	}

	function handleSearch(event: CustomEvent<{ query: string }>) {
		const query = event.detail.query;
		// Search is handled reactively in the drawer component
		console.log('Search query:', query);
	}

	async function handleSendMessage(message: string) {
		if (!selectedConversation) return;

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
							senderId: data.user.id
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
</script>

<svelte:head>
	<title>Direct Messages</title>
</svelte:head>

<div class="dm-container">
	{#if error}
		<div class="error-banner">
			<span>{error}</span>
			<button on:click={() => error = ''}>×</button>
		</div>
	{/if}

	<div class="dm-layout">
		<DMChatDrawer
			{conversations}
			currentUserId={data.user.id}
			isOpen={isDrawerOpen}
			on:selectChat={handleSelectChat}
			on:newChat={handleNewChat}
			on:search={handleSearch}
		/>

		<div class="chat-area" class:expanded={!isDrawerOpen}>
			{#if !isDrawerOpen}
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
					currentUserId={data.user.id}
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

		{#if isDrawerOpen}
			<button class="drawer-close" on:click={toggleDrawer}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		{/if}
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-container {
		height: 100vh;
		background: var(--bg-color);
		position: relative;
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
		height: 100vh;
		position: relative;
	}

	.chat-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		min-width: 0;

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
		top: 50%;
		right: -12px;
		transform: translateY(-50%);
		background: var(--secondary-color);
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
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
	}

	.no-conversation-content {
		text-align: center;
		max-width: 400px;
		padding: 40px 20px;
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

	@media (max-width: 768px) {
		.dm-layout {
			position: relative;
		}

		:global(.dm-chat-drawer) {
			position: absolute;
			top: 0;
			left: 0;
			height: 100vh;
			z-index: 100;
		}

		.drawer-close {
			display: none;
		}
	}
</style>