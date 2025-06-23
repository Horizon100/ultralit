<script lang="ts">
	import type { DMConversation } from '$lib/types/types';
	import DMHeader from './DMHeader.svelte';

	import { createEventDispatcher } from 'svelte';
	export let conversations: DMConversation[] = [];

	export let currentUserId: string;
	export let searchQuery = '';
	export let isOpen = true;

	const dispatch = createEventDispatcher<{
		selectChat: { conversationId: string };
		newChat: void;
		search: { query: string };
	}>();

	let searchInput: HTMLInputElement;

	function handleChatSelect(conversationId: string) {
		dispatch('selectChat', { conversationId });
	}

	function handleNewChat() {
		dispatch('newChat');
	}

	function handleSearch() {
		dispatch('search', { query: searchQuery });
	}

	function formatLastMessageTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMinutes < 1) {
			return 'now';
		} else if (diffMinutes < 60) {
			return `${diffMinutes}m`;
		} else if (diffHours < 24) {
			return `${diffHours}h`;
		} else if (diffDays < 7) {
			return `${diffDays}d`;
		} else {
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
	}

	function truncateMessage(content: string, maxLength = 50): string {
		if (content.length <= maxLength) return content;
		return content.substring(0, maxLength) + '...';
	}

	$: filteredConversations = conversations.filter(conv => 
		(conv.user.name || conv.user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
	);
</script>

<div class="dm-chat-drawer" class:closed={!isOpen}>
	<div class="drawer-header">
		<div class="header-title">
			<h2>Messages</h2>
			<button class="new-chat-btn" on:click={handleNewChat} title="New conversation">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>
		
		<div class="search-container">
			<div class="search-input-wrapper">
				<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
					<path d="21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					on:input={handleSearch}
					type="text"
					placeholder="Search conversations..."
					class="search-input"
				/>
				{#if searchQuery}
					<button class="clear-search" on:click={() => { searchQuery = ''; handleSearch(); }}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="conversations-list">
		{#if filteredConversations.length === 0}
			<div class="empty-state">
				{#if searchQuery}
					<div class="empty-icon">🔍</div>
					<p>No conversations found</p>
					<small>Try adjusting your search</small>
				{:else}
					<div class="empty-icon">💬</div>
					<p>No conversations yet</p>
					<small>Start a new conversation</small>
				{/if}
			</div>
		{:else}
			{#each filteredConversations as conversation (conversation.id)}
				<div 
					class="conversation-item" 
					class:active={conversation.isActive}
					class:unread={conversation.unreadCount > 0}
					on:click={() => handleChatSelect(conversation.id)}
					role="button"
					tabindex="0"
					on:keydown={(e) => e.key === 'Enter' && handleChatSelect(conversation.id)}
				>
					<DMHeader 
						user={conversation.user} 
						showStatus={true} 
						clickable={false}
					/>
					
					<div class="conversation-preview">
						{#if conversation.lastMessage}
							<div class="last-message">
								<span class="message-text">
									{#if conversation.lastMessage.senderId === currentUserId}
										You: 
									{/if}
									{truncateMessage(conversation.lastMessage.content)}
								</span>
								<span class="message-time">
									{formatLastMessageTime(conversation.lastMessage.timestamp)}
								</span>
							</div>
						{:else}
							<div class="no-messages">
								<span class="message-text">No messages yet</span>
							</div>
						{/if}
						
						{#if conversation.unreadCount > 0}
							<div class="unread-badge">
								{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-chat-drawer {
		width: auto;
        max-width: 250px;
		border-right: 1px solid var(--line-color);
		display: flex;
		flex-direction: column;
		transition: transform 0.3s ease;

		&.closed {
            width: 100px;
		}
	}

	.drawer-header {
		padding: 16px;
		border-bottom: 1px solid var(--line-color);
	}

	.header-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
        margin-right: 4rem;

		h2 {
			margin: 0;
			font-size: 18px;
			font-weight: 600;
			color: var(--text-color);
		}
	}

	.new-chat-btn {
		background: var(--secondary-color);
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--tertiary-color);
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			background: var(--tertiary-color);
			color: var(--primary-color);
			transform: scale(1.05);
		}
	}

	.search-container {
		margin-bottom: 8px;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 12px;
		color: var(--placeholder-color);
		z-index: 1;
	}

	.search-input {
		width: 100%;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		border-radius: 20px;
		padding: 8px 12px 8px 36px;
		color: var(--text-color);
		font-size: 14px;

		&::placeholder {
			color: var(--placeholder-color);
		}

		&:focus {
			outline: none;
			border-color: var(--tertiary-color);
		}
	}

	.clear-search {
		position: absolute;
		right: 8px;
		background: none;
		border: none;
		color: var(--placeholder-color);
		cursor: pointer;
		padding: 4px;
		border-radius: 50%;
		transition: all 0.2s ease;

		&:hover {
			background: var(--line-color);
			color: var(--text-color);
		}
	}

	.conversations-list {
		flex: 1;
		overflow-y: auto;

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-track {
			background: var(--primary-color);
		}

		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 3px;
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--placeholder-color);
		text-align: center;
		padding: 20px;

		.empty-icon {
			font-size: 32px;
			margin-bottom: 12px;
		}

		p {
			margin: 0 0 4px 0;
			font-size: 16px;
		}

		small {
			font-size: 12px;
			opacity: 0.8;
		}
	}

	.conversation-item {
		padding: 0;
		border-bottom: 1px solid var(--line-color);
		cursor: pointer;
		transition: background-color 0.2s ease;
		position: relative;

		&:hover {
			background: var(--secondary-color);
		}

		&.active {
			background: var(--tertiary-color);
			
			:global(.dm-header) {
				background: transparent;
			}

			:global(.username) {
				color: var(--primary-color);
			}

			:global(.status-text) {
				color: rgba(43, 42, 42, 0.7);
			}

			.conversation-preview {
				.message-text,
				.message-time {
					color: var(--primary-color);
				}
			}
		}

		&.unread {
			&::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				width: 3px;
				background: var(--tertiary-color);
			}
		}
	}

	.conversation-preview {
		padding: 0 16px 12px 68px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.last-message,
	.no-messages {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.message-text {
		font-size: 13px;
		color: var(--placeholder-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.message-time {
		font-size: 11px;
		color: var(--placeholder-color);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.unread-badge {
		background: var(--tertiary-color);
		color: var(--primary-color);
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	* {
		font-family: var(--font-family);
	}

    @media (max-width: 1000px) {
        
	.dm-chat-drawer {
		width: auto;
        max-width: 250px;
		background: var(--bg-color);
		border-right: 1px solid var(--line-color);
		display: flex;
		flex-direction: column;
		transition: transform 0.3s ease;

		&.closed {
            width: 100px;
		}
	}
    }
</style>