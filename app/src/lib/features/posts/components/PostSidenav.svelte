<script lang="ts">
	import { fly } from 'svelte/transition';
	import { showSidenav, showInput, showRightSidenav } from '$lib/stores/sidenavStore';
	import { t } from '$lib/stores/translationStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// export let innerWidth: number;
</script>

{#if $showSidenav}
	<aside class="left-sidebar" transition:fly={{ x: -300, duration: 300 }}>
		<div class="sidebar-content">
			<nav class="sidebar-nav">
				<h3>{$t('nav.quickAccess')}</h3>
				<ul>
					<li>
						<a href="/chat" class="sidebar-link">
							{@html getIcon('MessageSquare', { size: 20 })}
							<span>{$t('nav.chat')}</span>
						</a>
					</li>
					<li>
						<a href="/lean" class="sidebar-link">
							{@html getIcon('Calendar', { size: 20 })}
							<span>{$t('nav.tasks')}</span>
						</a>
					</li>
					<li>
						<a href="/canvas" class="sidebar-link">
							{@html getIcon('Sparkles', { size: 20 })}
							<span>{$t('nav.canvas')}</span>
						</a>
					</li>
					<li>
						<a href="/notes" class="sidebar-link">
							{@html getIcon('MessageSquare', { size: 20 })}
							<span>{$t('nav.notes')}</span>
						</a>
					</li>
				</ul>
			</nav>

			<!-- <div class="productivity-stats">
        <h4>Today's Progress</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">12</span>
            <span class="stat-label">Messages</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">3</span>
            <span class="stat-label">Tasks Done</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">45m</span>
            <span class="stat-label">Focus Time</span>
          </div>
        </div>
      </div> -->
		</div>
	</aside>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.left-sidebar {
		width: 250px;
		height: 92vh;
		position: sticky;
		top: 0;
		overflow-y: auto;
		border-right: 1px solid var(--line-color);
		// background: var(--bg-gradient-right);
	}

	.sidebar-content {
		padding: 1.5rem 1rem;
	}

	.sidebar-nav h3 {
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.sidebar-nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.sidebar-nav li {
		margin-bottom: 0.5rem;
	}

	.sidebar-link {
		display: flex;
		align-items: center;
		padding: 0.75rem;
		border-radius: 8px;
		color: var(--text-color);
		text-decoration: none;
		transition: background-color 0.2s ease;
	}

	.sidebar-link:hover {
		background-color: rgba(var(--primary-color), 0.1);
	}

	.sidebar-link span {
		margin-left: 0.75rem;
	}

	.productivity-stats {
		margin-top: 2rem;
		padding: 1rem;
		background: var(--bg-gradient);
		border-radius: 10px;
	}

	.productivity-stats h4 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: var(--text-color);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
	}

	.stat-value {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--primary-color);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-color);
		opacity: 0.8;
	}

	@media (max-width: 1000px) {
		.left-sidebar {
			background: var(--primary-color);
		}
	}
</style>
