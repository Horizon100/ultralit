<!-- Updated src/lib/components/Chat.svelte -->
<script lang="ts">
	export let compact = false;
	
	let messages: Array<{id: string, user: string, text: string, timestamp: string}> = [
		{ id: '1', user: 'Sarah', text: 'Hey everyone! Ready for the meeting?', timestamp: '2 min ago' },
		{ id: '2', user: 'Mike', text: 'Yes, looking forward to the demo', timestamp: '1 min ago' },
		{ id: '3', user: 'Alice', text: 'Can you hear me okay?', timestamp: '30 sec ago' }
	];
	let newMessage = '';

	function sendMessage() {
		if (newMessage.trim()) {
			messages = [...messages, {
				id: Date.now().toString(),
				user: 'You',
				text: newMessage,
				timestamp: 'now'
			}];
			newMessage = '';
		}
	}
</script>

<div class="chat" class:compact>
	<div class="chat-header">
		<h3>Chat</h3>
		<span class="message-count">{messages.length}</span>
	</div>
	
	<div class="messages">
		{#each messages as message}
			<div class="message">
				<div class="message-header">
					<strong class="username">{message.user}</strong>
					<span class="timestamp">{message.timestamp}</span>
				</div>
				<div class="message-text">{message.text}</div>
			</div>
		{/each}
	</div>
	
	<div class="chat-input">
		<input 
			bind:value={newMessage} 
			placeholder="Type a message..."
			on:keydown={(e) => e.key === 'Enter' && sendMessage()}
		/>
		<button on:click={sendMessage} disabled={!newMessage.trim()}>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
			</svg>
		</button>
	</div>
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #1a1a1a;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #111;
		border-bottom: 1px solid #333;
	}
	
	.chat.compact .chat-header {
		padding: 0.75rem;
	}

	.chat-header h3 {
		margin: 0;
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
	}
	
	.message-count {
		background: #667eea;
		color: white;
		padding: 0.125rem 0.5rem;
		border-radius: 1rem;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.messages {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.chat.compact .messages {
		padding: 0.5rem;
		gap: 0.5rem;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.username {
		color: #667eea;
		font-size: 0.75rem;
		font-weight: 600;
	}
	
	.timestamp {
		color: #6b7280;
		font-size: 0.625rem;
	}
	
	.message-text {
		color: #e5e7eb;
		font-size: 0.875rem;
		line-height: 1.4;
	}
	
	.chat.compact .message-text {
		font-size: 0.75rem;
	}

	.chat-input {
		display: flex;
		padding: 1rem;
		gap: 0.5rem;
		background: #111;
		border-top: 1px solid #333;
	}
	
	.chat.compact .chat-input {
		padding: 0.75rem;
	}

	.chat-input input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid #444;
		border-radius: 0.375rem;
		background: #2a2a2a;
		color: white;
		font-size: 0.875rem;
	}
	
	.chat.compact .chat-input input {
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
	}

	.chat-input input:focus {
		outline: none;
		border-color: #667eea;
	}

	.chat-input button {
		padding: 0.5rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chat-input button:hover:not(:disabled) {
		background: #5a67d8;
	}
	
	.chat-input button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
