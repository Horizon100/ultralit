
<!-- src/lib/components/Moderator.svelte -->
<script lang="ts">
	export let compact = false;
	
	let participants = [
		{ id: '1', name: 'John Doe', role: 'participant', muted: false, camera: true },
		{ id: '2', name: 'Jane Smith', role: 'moderator', muted: false, camera: true },
		{ id: '3', name: 'Bob Wilson', role: 'participant', muted: true, camera: false },
		{ id: '4', name: 'Alice Brown', role: 'participant', muted: false, camera: true }
	];
	
	function muteUser(userId: string) {
		participants = participants.map(p => 
			p.id === userId ? { ...p, muted: !p.muted } : p
		);
	}
	
	function toggleCamera(userId: string) {
		participants = participants.map(p => 
			p.id === userId ? { ...p, camera: !p.camera } : p
		);
	}
	
	function kickUser(userId: string) {
		participants = participants.filter(p => p.id !== userId);
	}
	
	function makeAdmin(userId: string) {
		participants = participants.map(p => 
			p.id === userId ? { ...p, role: p.role === 'moderator' ? 'participant' : 'moderator' } : p
		);
	}
</script>

<div class="moderator-panel" class:compact>
	<div class="mod-actions">
		<h3>Quick Actions</h3>
		<div class="action-buttons">
			<button class="action-btn">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
				</svg>
				Mute All
			</button>
			
			<button class="action-btn">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
				</svg>
				Stop Video
			</button>
			
			<button class="action-btn danger">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
				Lock Room
			</button>
		</div>
	</div>
	
	<div class="participants-list">
		<h3>Participants ({participants.length})</h3>
		<div class="participants">
			{#each participants as participant}
				<div class="participant-item">
					<div class="participant-info">
						<div class="participant-avatar">
							{participant.name.charAt(0)}
						</div>
						<div class="participant-details">
							<span class="participant-name">{participant.name}</span>
							<span class="participant-role" class:moderator={participant.role === 'moderator'}>
								{participant.role}
							</span>
						</div>
					</div>
					
					<div class="participant-controls">
						<button 
							class="control-btn"
							class:active={!participant.muted}
							on:click={() => muteUser(participant.id)}
							title={participant.muted ? 'Unmute' : 'Mute'}
						>
							{#if participant.muted}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
								</svg>
							{:else}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
								</svg>
							{/if}
						</button>
						
						<button 
							class="control-btn"
							class:active={participant.camera}
							on:click={() => toggleCamera(participant.id)}
							title={participant.camera ? 'Turn off camera' : 'Turn on camera'}
						>
							{#if participant.camera}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{:else}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
								</svg>
							{/if}
						</button>
						
						{#if participant.role !== 'moderator'}
							<button 
								class="control-btn admin"
								on:click={() => makeAdmin(participant.id)}
								title="Make moderator"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
							</button>
							
							<button 
								class="control-btn danger"
								on:click={() => kickUser(participant.id)}
								title="Remove from room"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	

	.moderator-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		gap: 1rem;
		overflow: hidden;
	}
	
	.moderator-panel.compact {
		padding: 0.5rem;
		gap: 0.5rem;
	}
	
	.mod-actions h3, .participants-list h3 {
		color: var(--text-color);
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
	}
	
	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--secondary-color);
		border: 1px solid #333;
		color: var(--text-color);
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.75rem;
	}
	
	.action-btn:hover {
		background: #2a2a2a;
		border-color: var(--tertiary-color);
	}
	
	.action-btn.danger:hover {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}
	
	.participants-list {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	
	.participants {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
	}
	
	.participant-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: var(--primary-color);
		border: 1px solid var(--line-color);
		border-radius: 0.375rem;
		transition: background 0.2s;
	}
	
	.participant-item:hover {
		background: var(--secondary-color);
	}
	
	.participant-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}
	
	.participant-avatar {
		width: 1.75rem;
		height: 1.75rem;
		background: var(--tertiary-color);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: bold;
		color: var(--text-color);
		flex-shrink: 0;
	}
	
	.participant-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	
	.participant-name {
		color: var(--text-color);
		font-size: 0.75rem;
		font-weight: 500;
	}
	
	.participant-role {
		color: #94a3b8;
		font-size: 0.625rem;
		text-transform: capitalize;
	}
	
	.participant-role.moderator {
		color: #10b981;
	}
	
	.participant-controls {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}
	
	.control-btn {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		border-radius: 0.25rem;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.control-btn:hover {
		background: var(--bg-color);
	}
	
	.control-btn.active {
		background: var(--tertiary-color);
		border-color: var(--line-color);
		color: var(--text-color);
	}
	
	.control-btn.admin:hover {
		background: var(--tertiary-color);
		border-color: var(--text-color);
		color: var(--text-color);
	}
	
	.control-btn.danger:hover {
		background: #ef4444;
		border-color: #ef4444;
		color: var(--text-color);
	}
</style>
