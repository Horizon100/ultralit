<!-- Updated src/lib/features/webrtc/components/VideoGrid.svelte -->
<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { participantsStore } from '$lib/features/webrtc/stores/participants-store';
	import { callStore } from '$lib/features/webrtc/stores/call-store';
	
	export let compact = false;

	// Initialize participants store when component mounts
	onMount(() => {
		participantsStore.initFromClient();
	});

	// Update video elements when streams change
	afterUpdate(() => {
		$participantsStore.forEach(participant => {
			if (participant.stream) {
				const videoElement = document.querySelector(`[data-participant-id="${participant.id}"]`) as HTMLVideoElement;
				if (videoElement && videoElement.srcObject !== participant.stream) {
					videoElement.srcObject = participant.stream;
				}
			}
		});
	});

	function getConnectionStatusColor(participant: any): string {
		if (participant.isLocal) return 'bg-blue-500';
		
		switch (participant.connectionState) {
			case 'connected': return 'bg-green-500';
			case 'connecting': return 'bg-yellow-500';
			case 'disconnected': return 'bg-red-500';
			case 'failed': return 'bg-red-600';
			default: return 'bg-gray-500';
		}
	}

	function getConnectionStatusText(participant: any): string {
		if (participant.isLocal) return 'Local';
		
		switch (participant.connectionState) {
			case 'connected': return 'Connected';
			case 'connecting': return 'Connecting';
			case 'disconnected': return 'Disconnected';
			case 'failed': return 'Failed';
			default: return 'Unknown';
		}
	}

	function handleVideoError(event: Event, participantId: string) {
		console.error('Video error for participant:', participantId, event);
	}

	function handleVideoLoadedMetadata(event: Event, participantId: string) {
		const video = event.target as HTMLVideoElement;
		console.log(`Video loaded for participant ${participantId}:`, {
			width: video.videoWidth,
			height: video.videoHeight,
			duration: video.duration
		});
	}
</script>

<div class="video-grid" class:compact>
	{#each $participantsStore as participant (participant.id)}
		<div class="video-container" class:local={participant.isLocal}>
			{#if participant.stream}
				<video 
					data-participant-id={participant.id}
					srcObject={participant.stream} 
					autoplay 
					muted={participant.isLocal}
					playsinline
					class="video-element"
					on:error={(e) => handleVideoError(e, participant.id)}
					on:loadedmetadata={(e) => handleVideoLoadedMetadata(e, participant.id)}
				/>
			{:else}
				<!-- Placeholder when no stream -->
				<div class="video-placeholder">
					<div class="avatar">
						{participant.name.charAt(0).toUpperCase()}
					</div>
					<div class="participant-info">
						<span class="name">{participant.name}</span>
						{#if !participant.isLocal}
							<span class="status">Waiting for video...</span>
						{/if}
					</div>
				</div>
			{/if}
			
			<!-- Participant name overlay -->
			<div class="participant-name">
				{participant.name}
				{#if participant.isLocal && $callStore.isScreenSharing}
					<span class="screen-indicator">(Screen)</span>
				{/if}
			</div>
			
			<!-- Connection status indicator -->
			<div class="connection-status">
				<div class="status-dot {getConnectionStatusColor(participant)}" 
					 title={getConnectionStatusText(participant)}>
				</div>
			</div>

			<!-- Audio/Video status indicators -->
			<div class="media-indicators">
				{#if participant.isLocal}
					<!-- Show local media controls status -->
					<div class="media-indicator" class:muted={!$callStore.isAudioEnabled}>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							{#if $callStore.isAudioEnabled}
								<path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.813L4.1 13.4a1 1 0 00-.6-.172H2a1 1 0 01-1-1V7.772a1 1 0 011-1h1.5a1 1 0 00.6-.172l4.283-3.413a1 1 0 011.617.813z" clip-rule="evenodd"/>
								<path d="M14.657 2.929a1 1 0 111.414 1.414A9.972 9.972 0 0118 10a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0016 10c0-2.21-.895-4.21-2.343-5.657z"/>
							{:else}
								<path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.813L4.1 13.4a1 1 0 00-.6-.172H2a1 1 0 01-1-1V7.772a1 1 0 011-1h1.5a1 1 0 00.6-.172l4.283-3.413a1 1 0 011.617.813z" clip-rule="evenodd"/>
								<path d="M15.293 7.293a1 1 0 011.414 0L18 8.586l1.293-1.293a1 1 0 111.414 1.414L19.414 10l1.293 1.293a1 1 0 01-1.414 1.414L18 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L16.586 10l-1.293-1.293a1 1 0 010-1.414z"/>
							{/if}
						</svg>
					</div>
					<div class="media-indicator" class:disabled={!$callStore.isVideoEnabled}>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							{#if $callStore.isVideoEnabled}
								<path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
							{:else}
								<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13V7a1 1 0 00-1.447-.894L14 7.382V6a2 2 0 00-2-2H9.586l4.707-4.707z" clip-rule="evenodd"/>
								<path d="M2 6a2 2 0 012-2h2.586l2 2H4v8a2 2 0 002 2h6.586l2 2H4a2 2 0 01-2-2V6z"/>
							{/if}
						</svg>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Empty state when no participants -->
		<div class="empty-state">
			{#if $callStore.isConnecting}
				<div class="loading">
					<svg class="spin w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path d="M21 12a9 9 0 1 1-6.219-8.56"/>
					</svg>
					<p>Connecting to room...</p>
				</div>
			{:else if !$callStore.isInCall}
				<div class="disconnected">
					<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
					</svg>
					<p>Not connected to room</p>
				</div>
			{:else}
				<div class="waiting">
					<svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
					<p>Waiting for other participants...</p>
					<p class="text-sm">Share the room link to invite others</p>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.video-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
		padding: 1rem;
		height: 100%;
		overflow: auto;
	}
	
	.video-grid.compact {
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.video-container {
		position: relative;
		background: #2a2a2a;
		border-radius: 8px;
		overflow: hidden;
		aspect-ratio: 16/9;
		transition: all 0.2s ease;
	}

	.video-container:hover {
		transform: scale(1.02);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.video-container.local {
		border: 2px solid #3b82f6;
	}

	.video-element {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: #1f2937;
	}

	.video-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
		color: white;
		gap: 1rem;
	}

	.avatar {
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		background: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: bold;
		color: white;
	}

	.compact .avatar {
		width: 2.5rem;
		height: 2.5rem;
		font-size: 1rem;
	}

	.participant-info {
		text-align: center;
	}

	.participant-info .name {
		display: block;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.participant-info .status {
		display: block;
		font-size: 0.75rem;
		color: #9ca3af;
	}


	.participant-name {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.875rem;
	}
	
	.compact .participant-name {
		font-size: 0.75rem;
		padding: 2px 6px;
	}
</style>
