<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import type { DMConversation, DMMessage, User } from '$lib/types/types';
	import { currentUser } from '$lib/pocketbase';
	import DMChat from '$lib/features/dm/components/DMChat.svelte';
	import DMChatDrawer from '$lib/features/dm/components/DMDrawer.svelte';
	import { getIcon } from '$lib/utils/lucideIcons';
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/utils/toastUtils';

	// Props
	export let user: User | null = null;
	export let initialConversationId: string | null = null;
	export let showDrawerToggle = true;
	export let isDrawerOpen = false;
	export let showDrawer: boolean = true;
	export let showChatHeader: boolean = true;
	export let shouldLoadConversations: boolean = true;

	// State
	let conversations: DMConversation[] = [];
	let selectedConversation: DMConversation | null = null;
	let messages: DMMessage[] = [];
	let loading = false;
	let initialLoading = true;
	let loadingConversations = false;
	let loadingMessages = false;
	let sendingMessage = false;
	let error = '';

	async function loadConversations() {
		if (!$currentUser) return;

		try {
			loadingConversations = true;
			error = '';

			const response = await fetch('/api/dm/conversations');
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load conversations');
			}

			conversations = result.conversations.map((conv: DMConversation) => ({
				...conv,
				lastMessage: conv.lastMessage
					? {
							...conv.lastMessage,
							timestamp: new Date(conv.lastMessage.timestamp)
						}
					: undefined
			}));

			// Mark active conversation
			if (initialConversationId) {
				conversations = conversations.map((conv) => ({
					...conv,
					isActive: conv.id === initialConversationId
				}));
			}

			// Show success toast only if conversations were loaded
			if (conversations.length > 0) {
				toast.success(
					`Loaded ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`,
					2000
				);
			}
		} catch (err) {
			console.error('Error loading conversations:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
			error = errorMessage;
			toast.error(errorMessage, 4000);
		} finally {
			loadingConversations = false;
		}
	}

	async function loadMessages(partnerId: string) {
		if (!$currentUser) return;

		try {
			loadingMessages = true;
			error = '';

			const response = await fetch(`/api/dm?receiverId=${partnerId}&perPage=100`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load messages');
			}

			messages = result.messages.map((msg: DMMessage) => ({
				...msg,
				created: msg.created,
				updated: msg.updated
			}));

			/*
			 * Show success toast for message loading (optional, might be too verbose)
			 * toast.info(`Loaded ${messages.length} message${messages.length !== 1 ? 's' : ''}`, 1500);
			 */
		} catch (err) {
			console.error('Error loading messages:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
			error = errorMessage;
			toast.error(errorMessage, 4000);
		} finally {
			loading = false;
			loadingMessages = false;
		}
	}

	async function findOrCreateConversationWithUser(userId: string) {
		const existingConv = conversations.find((conv) => conv.user.id === userId);

		if (existingConv) {
			// Found existing conversation, select it
			selectConversationById(existingConv.id);
			toast.info(`Opened conversation with ${existingConv.user.name}`, 2000);
		} else {
			await createConversationWithUser(userId);
			toast.info(`Starting new conversation with ${user?.name || user?.username}`, 2000);
		}
	}

	async function createConversationWithUser(userId: string) {
		if (!user || !$currentUser) return;
		const simulatedConversation: DMConversation = {
			id: `temp-${userId}`,
			content: [],
			user: {
				id: user.id,
				name: user.name || user.username,
				avatar: user.avatar,
				status: user.status || 'offline'
			},
			lastMessage: undefined,
			unreadCount: 0,
			isActive: true
		};
		conversations = [simulatedConversation, ...conversations];
		selectedConversation = simulatedConversation;
		messages = [];
		conversations = conversations.map((conv) => ({
			...conv,
			isActive: conv.id === simulatedConversation.id
		}));
	}

	function selectConversationById(convId: string) {
		const conversation = conversations.find((conv) => conv.id === convId);
		if (conversation) {
			selectedConversation = conversation;
			loadMessages(conversation.user.id);

			// Update active state
			conversations = conversations.map((conv) => ({
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
		if (!selectedConversation || !$currentUser) return;

		try {
			sendingMessage = true;
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

			// If this was a temporary conversation, update it with the real conversation data
			if (selectedConversation.id.startsWith('temp-')) {
				// Reload conversations to get the real conversation that was just created
				await loadConversations();
				// Try to find the new conversation with this user
				const newConv = conversations.find(
					(conv) => conv.user.id === selectedConversation!.user.id
				);
				if (newConv) {
					selectedConversation = newConv;
					toast.success('Conversation started!', 2000);
				}
			} else {
				// Update existing conversation's last message
				const updatedConversations = conversations.map((conv) => {
					if (conv.id === selectedConversation!.id) {
						return {
							...conv,
							lastMessage: {
								content: message,
								timestamp: new Date(),
								senderId: $currentUser!.id
							}
						};
					}
					return conv;
				});
				conversations = updatedConversations;
			}

			/*
			 * Optional: Show success toast for message sent
			 * toast.success('Message sent', 1000);
			 */
		} catch (err) {
			console.error('Error sending message:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
			error = errorMessage;
			toast.error(errorMessage, 4000);
		} finally {
			sendingMessage = false;
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
		const existingConv = conversations.find((conv) => conv.user.id === userId);
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

	$: if (initialConversationId && conversations.length > 0) {
		selectConversationById(initialConversationId);
	} else if (
		!initialConversationId &&
		user &&
		conversations.length > 0 &&
		$currentUser &&
		user.id !== $currentUser.id
	) {
		findOrCreateConversationWithUser(user.id);
	}

	onMount(async () => {
		if ($currentUser && shouldLoadConversations) {
			initialLoading = true;
			try {
				await loadConversations();
				if (!initialConversationId && user && user.id !== $currentUser?.id) {
					await findOrCreateConversationWithUser(user.id);
				} else if (initialConversationId) {
					selectConversationById(initialConversationId);
				}
			} finally {
				initialLoading = false;
			}
		}
	});
</script>

{#if initialLoading}
	<div class="loading-overlay">
		<div class="loading-spinner"></div>
	</div>
{/if}
{#if !currentUser}
	<div class="dm-error">
		<p>User authentication required</p>
	</div>
{:else}
	<div class="dm-module">
		{#if error}
			<div class="error-banner">
				<span>{error}</span>
				<button on:click={() => (error = '')}>×</button>
			</div>
		{/if}

		<div class="dm-layout" class:no-drawer={!showDrawer}>
			{#if showDrawer}
				<DMChatDrawer
					{conversations}
					currentUserId={$currentUser?.id || ''}
					isOpen={isDrawerOpen}
					on:selectChat={handleSelectChat}
					on:newChat={handleNewChat}
					on:search={handleSearch}
				/>
			{/if}
			{#if !isDrawerOpen && showDrawerToggle}
				<button class="drawer-toggle" on:click={toggleDrawer}>
					<Icon name="ListCollapse" />
				</button>
			{/if}

			<div class="chat-area" class:expanded={!isDrawerOpen}>
				{#if selectedConversation}
					<DMChat
						user={selectedConversation.user}
						{messages}
						currentUserId={$currentUser?.id || ''}
						onSendMessage={handleSendMessage}
						onMarkAsRead={handleMarkAsRead}
						showHeader={showChatHeader}
						loading={loadingMessages}
					/>
				{:else}
					<div class="no-conversation">
						<div class="no-conversation-content">
							{#if loadingConversations}
								<div class="loading-overlay">
									<div class="loading-spinner"></div>
								</div>
							{:else}
								<div class="no-conversation-icon">💬</div>
								<h2>Select a conversation</h2>
								<p>Choose a conversation from the sidebar to start messaging</p>
								{#if conversations.length === 0 && !loading}
									<button class="start-chat-btn" on:click={handleNewChat}>
										Start your first conversation
									</button>
								{/if}
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
					<Icon name="ListX" />
				</button>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-module {
		position: relative;
		overflow: hidden;
		display: flex;
		justify-content: center;
		width: auto;
		height: auto;
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
		width: 100%;
		flex: 1;
		align-items: flex-start;
		justify-content: flex-start;
		position: relative;
	}

	.chat-area {
		display: flex;
		flex-direction: row;
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
	.dm-layout.no-drawer .chat-area {
		width: 100%;
		border-left: none;
	}

	.loading-overlay {
		position: absolute !important;
		top: 0;
		left: 50%;
		width: 100%;
		height: 100%;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		background-color: transparent !important;
	}
	.loading-spinner {
		position: relative !important;
	}

	.drawer-toggle {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 100;
		background: var(--secondary-color);
		border: none;
		border-radius: 8px;
		width: 2rem;
		height: 2rem;
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
		position: relative !important;
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
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
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

		// .drawer-close {
		// 	// display: none;
		// }
	}
</style>
