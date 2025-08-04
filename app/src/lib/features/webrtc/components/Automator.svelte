
<!-- src/lib/components/Automator.svelte -->
<script lang="ts">
	export let compact = false;
	
	let automodQueue = [
		{ id: '1', user: 'SpamBot123', message: 'Click here for free money!!!', type: 'spam', timestamp: '2 min ago' },
		{ id: '2', user: 'ToxicUser', message: 'You are terrible at this', type: 'hostility', timestamp: '5 min ago' },
		{ id: '3', user: 'LinkSpammer', message: 'Check out my channel: badlink.com', type: 'link', timestamp: '8 min ago' }
	];
	
	let automodSettings = {
		spam: true,
		hostility: true,
		links: true,
		capsFilter: false,
		symbolFilter: true
	};
	
	function approveMessage(messageId: string) {
		automodQueue = automodQueue.filter(m => m.id !== messageId);
	}
	
	function denyMessage(messageId: string) {
		automodQueue = automodQueue.filter(m => m.id !== messageId);
	}
	
	function toggleSetting(setting: keyof typeof automodSettings) {
		automodSettings[setting] = !automodSettings[setting];
	}
</script>

<div class="automator-panel" class:compact>
	<div class="automod-settings">
		<h3>AutoMod Settings</h3>
		<div class="settings-list">
			<label class="setting-item">
				<input 
					type="checkbox" 
					bind:checked={automodSettings.spam}
					on:change={() => toggleSetting('spam')}
				/>
				<span>Spam Detection</span>
			</label>
			
			<label class="setting-item">
				<input 
					type="checkbox" 
					bind:checked={automodSettings.hostility}
					on:change={() => toggleSetting('hostility')}
				/>
				<span>Hostility Filter</span>
			</label>
			
			<label class="setting-item">
				<input 
					type="checkbox" 
					bind:checked={automodSettings.links}
					on:change={() => toggleSetting('links')}
				/>
				<span>Link Filter</span>
			</label>
			
			<label class="setting-item">
				<input 
					type="checkbox" 
					bind:checked={automodSettings.capsFilter}
					on:change={() => toggleSetting('capsFilter')}
				/>
				<span>Caps Filter</span>
			</label>
		</div>
	</div>
	
	<div class="automod-queue">
		<h3>AutoMod Queue ({automodQueue.length})</h3>
		
		{#if automodQueue.length === 0}
			<div class="empty-state">
				<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p>All clear! No messages in queue.</p>
			</div>
		{:else}
			<div class="queue-items">
				{#each automodQueue as item}
					<div class="queue-item">
						<div class="item-header">
							<span class="username">{item.user}</span>
							<span class="filter-type" class:spam={item.type === 'spam'} class:hostility={item.type === 'hostility'} class:link={item.type === 'link'}>
								{item.type}
							</span>
							<span class="timestamp">{item.timestamp}</span>
						</div>
						
						<div class="message-content">
							"{item.message}"
						</div>
						
						<div class="item-actions">
							<button class="approve-btn" on:click={() => approveMessage(item.id)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Allow
							</button>
							
							<button class="deny-btn" on:click={() => denyMessage(item.id)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
								Deny
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	

	.automator-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		gap: 1rem;
		overflow: hidden;
	}
	
	.automator-panel.compact {
		padding: 0.5rem;
		gap: 0.5rem;
	}
	
	.automod-settings h3, .automod-queue h3 {
		color: var(--text-color);
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
	}
	
	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.setting-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #94a3b8;
		font-size: 0.75rem;
		cursor: pointer;
	}
	
	.setting-item input[type="checkbox"] {
		accent-color: var(--tertiary-color);
	}
	
	.automod-queue {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--placeholder-color);
		text-align: center;
		gap: 0.5rem;
	}
	
	.empty-state p {
		font-size: 0.75rem;
		margin: 0;
	}
	
	.queue-items {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
				scroll-behavior: smooth;
		overflow-x: hidden;
				overflow-y: auto;

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
	}
	
	.queue-item {
		background: var(--bg-color);
		border: 1px solid #333;
		border-radius: 0.375rem;
		padding: 0.75rem;
		transition: background 0.2s;
	}
	
	.queue-item:hover {
		background: #2a2a2a;
	}
	
	.item-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.username {
		color: var(--text-color);
		font-size: 0.75rem;
		font-weight: 500;
	}
	
	.filter-type {
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
	}
	
	.filter-type.spam {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}
	
	.filter-type.hostility {
		background: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
	}
	
	.filter-type.link {
		background: rgba(139, 92, 246, 0.2);
		color: #8b5cf6;
	}
	
	.timestamp {
		color: #6b7280;
		font-size: 0.625rem;
		margin-left: auto;
	}
	
	.message-content {
		color: #94a3b8;
		font-size: 0.75rem;
		margin-bottom: 0.75rem;
		line-height: 1.4;
		font-style: italic;
	}
	
	.item-actions {
		display: flex;
		gap: 0.5rem;
	}
	
	.approve-btn, .deny-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.625rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}
	
	.approve-btn {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}
	
	.approve-btn:hover {
		background: #10b981;
		color: var(--text-color);
	}
	
	.deny-btn {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}
	
	.deny-btn:hover {
		background: #ef4444;
		color: var(--text-color);
	}
</style>