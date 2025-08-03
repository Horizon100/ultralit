<!-- src/lib/components/ProjectCard.svelte -->
<script lang="ts">
	export let compact = false;
	
	let projects = [
		{
			id: '1',
			name: 'Q4 Planning Meeting',
			status: 'live',
			participants: 12,
			duration: '45 min',
			thumbnail: null,
			roomId: 'room-123'
		},
		{
			id: '2',
			name: 'Product Demo',
			status: 'scheduled',
			participants: 0,
			scheduledTime: '2:00 PM',
			thumbnail: null,
			roomId: 'room-456'
		},
		{
			id: '3',
			name: 'Team Standup',
			status: 'ended',
			participants: 8,
			duration: '15 min',
			endedTime: '30 min ago',
			roomId: 'room-789'
		}
	];
	
	function joinRoom(roomId: string) {
		window.location.href = `webrtc/room/${roomId}`;
	}
	
	function scheduleRoom(projectId: string) {
		console.log('Schedule room for project:', projectId);
	}
	
	function viewRecording(projectId: string) {
		console.log('View recording for project:', projectId);
	}
</script>

<div class="projects-panel" class:compact>
	<div class="projects-header">
		<h3>Active Projects</h3>
		<button class="new-project-btn">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			New Project
		</button>
	</div>
	
	<div class="projects-grid">
		{#each projects as project}
			<div class="project-card">
				<div class="project-thumbnail">
					{#if project.status === 'live'}
						<div class="live-indicator">
							<div class="live-dot"></div>
							LIVE
						</div>
					{/if}
					
					{#if project.thumbnail}
						<img src={project.thumbnail} alt={project.name} />
					{:else}
						<div class="placeholder-thumbnail">
							<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						</div>
					{/if}
				</div>
				
				<div class="project-info">
					<h4 class="project-name">{project.name}</h4>
					
					<div class="project-meta">
						{#if project.status === 'live'}
							<span class="meta-item">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
								</svg>
								{project.participants} participants
							</span>
							<span class="meta-item">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								{project.duration}
							</span>
						{:else if project.status === 'scheduled'}
							<span class="meta-item">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Scheduled for {project.scheduledTime}
							</span>
						{:else if project.status === 'ended'}
							<span class="meta-item">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Ended {project.endedTime}
							</span>
						{/if}
					</div>
					
					<div class="project-actions">
						{#if project.status === 'live'}
							<button class="action-btn primary" on:click={() => joinRoom(project.roomId)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
								</svg>
								Join
							</button>
						{:else if project.status === 'scheduled'}
							<button class="action-btn secondary" on:click={() => scheduleRoom(project.id)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
								</svg>
								Edit
							</button>
							<button class="action-btn primary" on:click={() => joinRoom(project.roomId)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M12 5C8.686 5 6 7.686 6 11c0 3.197 1.697 5.742 4 6.586V21a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3.414c2.303-.844 4-3.389 4-6.586 0-3.314-2.686-6-6-6z" />
								</svg>
								Start Early
							</button>
						{:else if project.status === 'ended'}
							<button class="action-btn secondary" on:click={() => viewRecording(project.id)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M12 5C8.686 5 6 7.686 6 11c0 3.197 1.697 5.742 4 6.586V21a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-3.414c2.303-.844 4-3.389 4-6.586 0-3.314-2.686-6-6-6z" />
								</svg>
								Recording
							</button>
							<button class="action-btn primary" on:click={() => joinRoom(project.roomId)}>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Restart
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.projects-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		overflow: hidden;
	}
	
	.projects-panel.compact {
		padding: 0.5rem;
	}
	
	.projects-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.projects-header h3 {
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0;
	}
	
	.new-project-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: #667eea;
		color: white;
		border: none;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}
	
	.new-project-btn:hover {
		background: #5a67d8;
	}
	
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		overflow-y: auto;
		flex: 1;
	}
	
	.project-card {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 0.5rem;
		overflow: hidden;
		transition: all 0.2s;
	}
	
	.project-card:hover {
		border-color: #667eea;
		transform: translateY(-2px);
	}
	
	.project-thumbnail {
		position: relative;
		aspect-ratio: 16/9;
		background: #2a2a2a;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.live-indicator {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: rgba(239, 68, 68, 0.9);
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.625rem;
		font-weight: bold;
		z-index: 10;
	}
	
	.live-dot {
		width: 0.375rem;
		height: 0.375rem;
		background: white;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}
	
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
	
	.placeholder-thumbnail {
		color: #6b7280;
	}
	
	.project-info {
		padding: 0.75rem;
	}
	
	.project-name {
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		line-height: 1.2;
	}
	
	.project-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
	}
	
	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: #94a3b8;
		font-size: 0.75rem;
	}
	
	.project-actions {
		display: flex;
		gap: 0.5rem;
	}
	
	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		flex: 1;
		justify-content: center;
	}
	
	.action-btn.primary {
		background: #667eea;
		color: white;
	}
	
	.action-btn.primary:hover {
		background: #5a67d8;
	}
	
	.action-btn.secondary {
		background: transparent;
		color: #94a3b8;
		border: 1px solid #374151;
	}
	
	.action-btn.secondary:hover {
		background: rgba(102, 126, 234, 0.1);
		border-color: #667eea;
		color: white;
	}
</style>