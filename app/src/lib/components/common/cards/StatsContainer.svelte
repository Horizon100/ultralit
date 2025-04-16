<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';

	export let threadCount = 0;
	export let messageCount = 0;
	export let tagCount = 0;
	export let timerCount = 0;
	export let lastActive: Date | null = null;

	function formatTimerCount(seconds: number): string {
		const hours = Math.floor(seconds / 60);
		const remainingMinutes = seconds % 60;
		return `${hours}h ${remainingMinutes}m`;
	}

	function formatDate(date: string): string {
		if (date === 'Today' || date === 'Yesterday') return date;
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function calculatePercentage(count: number, target: number): number {
		return Math.min(Math.round((count / target) * 100), 100);
	}

	async function fetchStats() {
		if (!$currentUser) {
			console.error('User is not authenticated');
			return;
		}

		try {
			// Fetch stats from API endpoint
			const response = await fetch(`/api/verify/users/${$currentUser.id}/stats`, {
				credentials: 'include'
			});
			
			if (!response.ok) {
				throw new Error(`Failed to fetch stats: ${response.status}`);
			}
			
			const data = await response.json();
			
			if (data.success) {
				threadCount = data.threadCount || 0;
				messageCount = data.messageCount || 0;
				tagCount = data.tagCount || 0;
				timerCount = data.timerCount || 0;
				
				if (data.lastActive) {
					lastActive = new Date(data.lastActive);
				}
				
				console.log('Stats fetched successfully');
			} else {
				console.error('Error in stats response:', data.error);
			}
		} catch (error) {
			console.error('Error fetching stats:', error);
			// Use default values if the API fails
			threadCount = threadCount || 0;
			messageCount = messageCount || 0;
			tagCount = tagCount || 0;
			timerCount = timerCount || 0;
		}
	}

	onMount(() => {
		// If stats are already provided as props, don't fetch
		if (threadCount === 0 && messageCount === 0 && tagCount === 0 && timerCount === 0) {
			fetchStats();
		}
	});
</script>

<div class="stats-container">
	<div class="title">
		<h2>{$t('dashboard.title')}</h2>
	</div>
	<div class="stat-item" style="--progress: {calculatePercentage(threadCount, 1000)}%">
		<span>{threadCount} {$t('dashboard.nameThreads')}</span>
		<span class="target">1000 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {calculatePercentage(messageCount, 1000)}%">
		<span>{messageCount} {$t('dashboard.nameMessages')}</span>
		<span class="target">1000 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {calculatePercentage(tagCount, 1000)}%">
		<span>{tagCount} {$t('dashboard.nameTags')}</span>
		<span class="target">1000 ✰</span>
	</div>

	<div class="stat-item" style="--progress: {calculatePercentage(timerCount, 3600)}%">
		<span>{formatTimerCount(timerCount)} {$t('dashboard.nameTimer')}</span>
		<span class="target">1000 ✰</span>
	</div>

	<div class="last-active">
		{$t('dashboard.nameActive')}
		{lastActive ? formatDate(lastActive.toString()) : 'Never'}
	</div>
</div>
<style lang="scss">
	
	* {
      font-family: var(--font-family);

    }
	.stats-container {
		// background: var(--bg-gradient);
		backdrop-filter: blur(10px);
		// padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
		max-width: 600px;
		height: auto;
		margin-top: 0;
		margin-left: 0;
		position: relative;
		overflow: hidden;
		
	}

	.stats-container::before {
		content: '';
		position: absolute;
		top: -150%;
		left: -150%;
		width: 300%;
		height: 300%;
		background: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2),
			rgba(255, 255, 255, 0.2)
		);
		transform: translateX(-100%) rotate(45deg);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	.title {
		display: flex;
	}
	.stats-container:hover::before {
		animation: swipe 0.5s cubic-bezier(0.42, 0, 0.58, 1);
		opacity: 1;
	}

	@keyframes swipe {
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}

	.stats-container h2 {
		display: flex;
		justify-content: right;
		color: white;
	}

	.stat-item {
		display: flex;
		align-items: center;
		position: relative;
		padding: 1rem;
		justify-content: space-between;
		color: #cccccc;
		font-size: 1rem;
		overflow: hidden;
		transition: all 0.5s ease;
		border-radius: 0.5rem;
		background: linear-gradient(
			to right,
			rgba(0, 128, 0, 0.2) var(--progress),
			rgba(128, 128, 128, 0.1) var(--progress)
		);
	}

	.stat-item:hover {
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 20%,
			rgba(247, 247, 247, 0.2) 96%
		);
	}

	.stat-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			rgba(1, 149, 137, 0.5) var(--progress),
			transparent var(--progress)
		);
		z-index: -1;
	}

	.last-active {
		color: #cccccc;
		text-align: right;
		font-size: 0.9em;
	}
</style>
