<!-- src/lib/components/Sidebar.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
	
	let icons: any = {};
	let iconsLoaded = false;
	
	import('lucide-svelte').then((lucide) => {
		icons = {
			Home: lucide.Home,
			LayoutDashboard: lucide.LayoutDashboard,
			Video: lucide.Video,
			BookOpen: lucide.BookOpen,
			Settings: lucide.Settings
		};
		iconsLoaded = true;
	}).catch((error) => {
		console.error('Failed to load Lucide icons:', error);
		iconsLoaded = false;
	});

	const menuItems = [
		{ path: '/webrtc/', label: 'Home', icon: 'Home', emoji: '🏠' },
		{ path: '/webrtc/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', emoji: '📊' },
		{ path: '/webrtc/lobby', label: 'Join Room', icon: 'Video', emoji: '🎥' },
		{ path: '/webrtc/docs', label: 'Documentation', icon: 'BookOpen', emoji: '📚' },
		{ path: '/webrtc/settings', label: 'Settings', icon: 'Settings', emoji: '⚙️' }
	];
	
	$: currentPath = $page.url.pathname;
</script>

<aside class="sidebar">
	<nav class="sidebar-nav">
		{#each menuItems as item}
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
		{/each}
	</nav>
	
	<div class="sidebar-footer">
		<div class="status-indicator">
			<div class="status-dot online"></div>
			<span>Online</span>
		</div>
		
		{#if !iconsLoaded}
			<div class="icon-status">
				<small>Using emoji fallback</small>
			</div>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: 250px;
		background: #111;
		border-right: 1px solid #333;
		display: flex;
		flex-direction: column;
		padding: 1rem 0;
	}
	
	.sidebar-nav {
		flex: 1;
		padding: 0 1rem;
	}
	
	.nav-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		color: #94a3b8;
		text-decoration: none;
		border-radius: 0.5rem;
		margin-bottom: 0.25rem;
		transition: all 0.2s;
	}
	
	.nav-item:hover {
		background: rgba(102, 126, 234, 0.1);
		color: white;
	}
	
	.nav-item.active {
		background: rgba(102, 126, 234, 0.2);
		color: #667eea;
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
		color: #6b7280;
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