<!-- src/lib/components/Sidebar.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	let icons: any = {};
	let iconsLoaded = false;
	  let roomName = '';
  let userName = '';
	
	import('lucide-svelte').then((lucide) => {
		icons = {
			Home: lucide.Home,
			LayoutDashboard: lucide.LayoutDashboard,
			Video: lucide.Video,
			BookOpen: lucide.BookOpen,
			Settings: lucide.Settings,
			Plus: lucide.Plus
		};
		iconsLoaded = true;
	}).catch((error) => {
		console.error('Failed to load Lucide icons:', error);
		iconsLoaded = false;
	});

	const menuItems = [
		{ path: '/webrtc', label: 'Home', icon: 'Home', emoji: '🏠' },
		{ path: '/webrtc/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', emoji: '📊' },
		{ path: '/webrtc/lobby', label: 'Join Room', icon: 'Video', emoji: '🎥' },
    { label: 'Create Room', icon: 'Plus', emoji: '➕', action: 'createRoom' },
		// { path: '/webrtc/docs', label: 'Documentation', icon: 'BookOpen', emoji: '📚' },
		// { path: '/webrtc/settings', label: 'Settings', icon: 'Settings', emoji: '⚙️' }
	];
function handleMenuAction(action: string) {
    switch (action) {
        case 'createRoom':
            createRoom();
            break;
    }
}
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
	$: currentPath = $page.url.pathname;

</script>

<aside class="sidebar">
	<nav class="sidebar-nav">
{#each menuItems as item}
    {#if item.path}
        <a 
            href={item.path} 
            class="nav-item"
            class:active={currentPath === item.path}
        >
            <div class="nav-icon">
                {#if iconsLoaded && icons[item.icon]}
                    <svelte:component this={icons[item.icon]} size={20} />
                {:else}
                    <span>{item.emoji}</span>
                {/if}
            </div>
            <span class="nav-label">{item.label}</span>
        </a>
    {:else if item.action}
        <button 
            class="nav-item" 
            on:click={() => handleMenuAction(item.action)}
			    class:active={item.action === 'createRoom' && currentPath.startsWith('/webrtc/room/')}

        >
            <div class="nav-icon">
                {#if iconsLoaded && icons[item.icon]}
                    <svelte:component this={icons[item.icon]} size={20} />
                {:else}
                    <span>{item.emoji}</span>
                {/if}
            </div>
            <span class="nav-label">{item.label}</span>
        </button>
    {/if}
{/each}
	</nav>
	
	<!-- <div class="sidebar-footer">
		<div class="status-indicator">
			<div class="status-dot online"></div>
			<span>Online</span>
		</div>
		
		{#if !iconsLoaded}
			<div class="icon-status">
				<small>Using emoji fallback</small>
			</div>
		{/if}
	</div> -->
</aside>

<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	
	.sidebar {
		width: 100%;
		background: var(--bg-gradient);
		height: 3rem;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}
	
	.sidebar-nav {
		display: flex;
		flex-direction: row;
		flex: 1;
		gap: 0.5rem;
				justify-content: center;
		align-items: center;
	}
	
	.nav-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 1rem;
		color: var(--placeholder-color);
		background-color: var(--primary-color);
		text-decoration: none;
		border-radius: 0.5rem;
		transition: all 0.2s;
		width: auto !important;
		outline: none;
		border: none;
	}
	
	.nav-item:hover {
		background: var(--secondary-color);
		color: var(--text-color);
	}
	
	.nav-item.active {
		background: var(--bg-color) !important;
		color: var(--tertiary-color) !important;
	}
	
	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 1.25rem;
	}
	
	.nav-label {
		font-weight: 500;
		font-size: 1rem;
	}
	
	.sidebar-footer {
		padding: 1rem;
		border-top: 1px solid #333;
	}
	
	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #94a3b8;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
	}
	
	.icon-status {
		color: var(--placeholder-color);
		font-size: 0.75rem;
	}
	
	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}
	
	.status-dot.online {
		background: #10b981;
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}
	
	@media (max-width: 768px) {
		.sidebar {
			width: 60px;
		}
		
		.nav-label {
			display: none;
		}
		
		.sidebar-footer {
			padding: 0.5rem;
		}
		
		.status-indicator span {
			display: none;
		}
		
		.icon-status {
			display: none;
		}
	}
</style>