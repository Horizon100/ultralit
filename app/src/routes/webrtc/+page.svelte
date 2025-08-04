<!-- src/routes/webrtc/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import Icon
	 from '$lib/components/ui/Icon.svelte';
	  let roomName = '';
  let userName = '';
	let recentRooms = [
		{ id: '1', name: 'Team Meeting', participants: 5, lastUsed: '2 hours ago' },
		{ id: '2', name: 'Project Demo', participants: 12, lastUsed: '1 day ago' },
		{ id: '3', name: 'Daily Standup', participants: 8, lastUsed: '3 days ago' }
	];

	// function quickJoin() {
	// 	goto('/webrtc/lobby');
	// }
	
  async function createRoom() {
    const response = await fetch('/api/webrtc/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName })
    });
    
    if (response.ok) {
      const room = await response.json();
      goto(`/webrtc/room/${room.roomId}`);
    }
  }
	function joinRoom(roomId: string) {
		goto(`/webrtc/room/${roomId}`);
	}

	// // Redirect to login if not authenticated
	// $: if ($currentUser === null) {
	// 	goto('/auth/signin?redirect=/webrtc');
	// }
</script>

<svelte:head>
	<title>Video Conferencing - Vrazum</title>
</svelte:head>
<main>

{#if $currentUser}
	<div class="home-page">
		<div class="hero-section">
			<div class="hero-content">
				<h1 class="hero-title">
					Welcome back, {$currentUser.username || $currentUser.name || 'User'}!
					Connect with your team
					<span class="gradient-text">anywhere</span>
				</h1>
				<p class="hero-subtitle">
					High-quality video calls with advanced moderation tools and real-time collaboration.
				</p>
				
				<!-- <div class="hero-actions">
					<button class="btn-primary" on:click={openModal}>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						Quick Join
					</button>
					
					<button class="btn-secondary" on:click={createRoom}>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
						Create Room
					</button>
				</div> -->
			</div>
			
			<!-- <div class="hero-visual">
				<div class="demo-grid">
					<div class="demo-video active">
						<div class="demo-avatar">
							{#if $currentUser.avatar}
								<img src="{$currentUser.avatarUrl || $currentUser.avatar}" alt="You" />
							{:else}
								👤
							{/if}
						</div>
						<span>You</span>
					</div>
					<div class="demo-video">
						<div class="demo-avatar">👩</div>
						<span>Sarah</span>
					</div>
					<div class="demo-video">
						<div class="demo-avatar">👨</div>
						<span>Mike</span>
					</div>
					<div class="demo-video">
						<div class="demo-avatar">👩‍💼</div>
						<span>Emma</span>
					</div>
				</div>
			</div> -->
		</div>
		
		<!-- <div class="recent-section">
			<h2>Recent Rooms</h2>
			<div class="rooms-grid">
				{#each recentRooms as room}
					<div class="room-card" on:click={() => joinRoom(room.id)} on:keydown role="button" tabindex="0">
						<div class="room-header">
							<h3>{room.name}</h3>
							<span class="participants">{room.participants} participants</span>
						</div>
						<div class="room-footer">
							<span class="last-used">{room.lastUsed}</span>
							<button class="join-btn">Join</button>
						</div>
					</div>
				{/each}
			</div>
		</div> -->
		
		<div class="features-section">
			<!-- <h2>Powerful Features</h2> -->
			<div class="features-grid">
				<div class="feature-card">
					<div class="feature-icon">🎥</div>
					<h3>HD Video Quality</h3>
					<p>Crystal clear video with adaptive bitrate streaming</p>
				</div>
				
				<div class="feature-card">
					<div class="feature-icon">🛡️</div>
					<h3>Advanced Moderation</h3>
					<p>Comprehensive tools to manage participants and content</p>
				</div>
				
				<div class="feature-card">
					<div class="feature-icon">🤖</div>
					<h3>Smart Automation</h3>
					<p>Automated moderation and intelligent room management</p>
				</div>
				
				<div class="feature-card">
					<div class="feature-icon">💬</div>
					<h3>Real-time Chat</h3>
					<p>Integrated messaging with file sharing and reactions</p>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="loading-container">
		<p>Loading...</p>
	</div>
{/if}
</main>
<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	
	.home-page {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}
	
	.hero-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		margin-bottom: 2rem;
	}
	
	.hero-title {
		font-size: 2.5rem;
		font-weight: bold;
		line-height: 1.1;
		margin-bottom: 1.5rem;
		color: var(--text-color);
		
	}
	
	.gradient-text {
		background: var(--tertiary-color);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	
	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--placeholder-color);
		margin-bottom: 2.5rem;
		line-height: 1.6;
	}
	
	.hero-actions {
		display: flex;
		gap: 1rem;
	}
	
	.btn-primary, .btn-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-gradient-r);
		color: var(--text-color);
		padding: 1rem 2rem;
		border: 1px solid var(--primary-color);
		border-radius: 2rem;
		font-size: 1.125rem;
		font-weight: 600;

		cursor: pointer;
		transition: all 0.2s;
	}
	
	.btn-primary:hover, .btn-secondary:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px var(--tertiary-color);
		color: var(--tertiary-color);

	}
	
	.btn-secondary {
		opacity: 0.5;
		&:hover {
			opacity: 1;
		}
	}

	
	
	
	.demo-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding: 2rem;
		background: #111;
		border-radius: 1rem;
		border: 1px solid #333;
	}
	
	.demo-video {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		aspect-ratio: 16/9;
		background: #1a1a1a;
		border-radius: 0.5rem;
		padding: 1rem;
		border: 2px solid transparent;
		transition: all 0.3s;
	}
	
	.demo-video.active {
		border-color: #667eea;
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
	}
	
	.demo-avatar {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}
	
	.recent-section, .features-section {
		margin-bottom: 4rem;
	}
	
	.recent-section h2, .features-section h2 {
		font-size: 2rem;
		font-weight: bold;
		margin-bottom: 2rem;
		text-align: center;
		color: var(--text-color)
	}
	
	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}
	
	.room-card {
		background: var(--primary-color);
		border: 1px solid var(--line-color);
		border-radius: 0.75rem;
		padding: 1.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.room-card:hover {
		border-color: var(--tertiary-color);
		transform: translateY(-2px);
	}
	
	.room-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		margin-bottom: 1rem;
	}
	
	.room-header h3 {
		font-size: 1.25rem;
		font-weight: 600;
	}
	
	.participants {
		color: var(--placeholder-color);
		font-size: 0.875rem;
	}
	
	.room-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.last-used {
		color: #6b7280;
		font-size: 0.875rem;
	}
	
	.join-btn {
		background: var(--secondary-color);
		color: var(--text-color);
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}
	
	.join-btn:hover {
		background: var(--tertiary-color);
		color: var(--primary-color);
	}
	
	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
	}
	
	.feature-card {
		text-align: center;
		padding: 2rem;
		background: var(--primary-color);

		border-radius: 0.75rem;
		transition: all 0.2s;
	}
	
	.feature-card:hover {
		border-color: #667eea;
		transform: translateY(-4px);
	}
	
	.feature-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}
	
	.feature-card h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}
	
	.feature-card p {
		color: #94a3b8;
		line-height: 1.6;
	}
	  .lobby {
    display: flex;
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
    justify-content: center;
    align-items: center;
    // height: calc(100vh - 4rem);
    		background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 60%);
		backdrop-filter: blur(10px);
  }

  .lobby-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    max-width: 400px;
    width: 100%;
    user-select: none;
    & h1 {
      color: var(--tertiary-color);
      text-align: center;
    }
    & input {
      padding: 0.5rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 1rem;
      border: 1px solid var(--line-color);
      background: var(--secondary-color);
      font-size: 1rem;
      color: var(--placeholder-color);
      width: calc(100% - 2rem);
      &:focus {
        color: var(--text-color);
        border: 1px solid var(--tertiary-color);
        outline: none;
        background: var(--primary-color);
      }
    }
	& .close-wrapper {

		width: 100%;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}
    & button {
      padding: 0.5rem 1rem;
      width: 100%;
      border-radius: 2rem;
      border: 1px solid var(--line-color);
      background: var(--primary-color);
      color: var(--placeholder-color);
      font-size: 1.2rem;
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover {
        transform: scale(1.1);
        color: var(--tertiary-color);
      }
	  &.close {
		position: relative;
		padding: 0;
		border: none;
		height: 3rem;
		width: 3rem;
		color: red;
		background: transparent;
		&:hover {
			background: red;
			color: white;
		}
	  }
    }
  }

	@media (max-width: 768px) {
		.hero-section {
			grid-template-columns: 1fr;
			gap: 2rem;
			text-align: center;
		}
		
		.hero-title {
			font-size: 2.5rem;
		}
		
		.hero-actions {
			justify-content: center;
		}
	}
</style>