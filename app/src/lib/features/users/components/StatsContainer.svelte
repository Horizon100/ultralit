<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import type {
		Perk,
		PerkFilterCondition,
		TimerSession,
		TimerSessionSummary
	} from '$lib/types/types';
	import { t } from '$lib/stores/translationStore';
	import { fade } from 'svelte/transition';
	import { PERKS, INCREMENTS } from '$lib/features/users/utils/perks';
	import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';

	export let projectId: string | undefined = undefined;
	export let threadCount = 0;
	export let messageCount = 0;
	export let taskCount = 0;
	export let tagCount = 0;
	export let timerCount = 0;
	export let lastActive: Date | null = null;
	export let perks: Perk[] = [];

	let loading = false;
	let checkingPerks = false;
	let error: string | null = null;
	let showPerksPanel = false;
	let newPerksFound = 0;
	let localPerks: Perk[] = [];
	let timerTarget = 8 * 3600;

	function calculateTotalTimerDuration(sessions: TimerSession[]): number {
		if (!sessions || !Array.isArray(sessions)) {
			console.log('No timer sessions found or invalid format');
			return 0;
		}

		const totalSeconds = sessions.reduce((total, session) => {
			if (session && typeof session.duration === 'number') {
				return total + session.duration;
			}
			return total;
		}, 0);

		console.log(
			'Total timer duration calculated:',
			totalSeconds,
			'seconds from',
			sessions.length,
			'sessions'
		);
		return totalSeconds;
	}

	function formatTimerCount(seconds: number): string {
		console.log('Formatting timer count from seconds:', seconds);
		const hours = Math.floor(seconds / 3600);
		const remainingMinutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${remainingMinutes}m`;
	}
	function formatNumber(num: number): string {
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}
	function formatDate(date: string): string {
		console.log('Formatting date:', date);
		if (!date) return 'Never';

		if (date === 'Today' || date === 'Yesterday') return date;

		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const dateObj = new Date(date);
		console.log('Date object created:', dateObj);

		if (dateObj.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (dateObj.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		}

		try {
			return dateObj.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch (e) {
			console.error('Error formatting date:', e);
			return 'Invalid date';
		}
	}

	function calculatePercentage(count: number, target: number): number {
		if (count >= target) return 100;
		const percentage = Math.round((count / target) * 100);
		return percentage;
	}

	function checkPerksAgainstStats() {
		console.log('DEBUG: Checking perks against current stats');
		console.log('DEBUG: Current stats:', { threadCount, messageCount, taskCount, tagCount });

		// Manually check eligible perks from PERKS data
		const eligiblePerks = PERKS.filter((perk) => {
			const isEligible = perk.filterConditions.every((condition: PerkFilterCondition) => {
				let userValue = 0;

				// Get appropriate stat value
				switch (condition.parameter) {
					case 'messages':
						userValue = messageCount;
						break;
					case 'threads':
						userValue = threadCount;
						break;
					case 'tasks':
						userValue = taskCount;
						break;
					case 'tags':
						userValue = tagCount;
						break;
				}

				// Evaluate the condition
				let result = false;
				switch (condition.operator) {
					case '=':
						result = userValue === condition.value;
						break;
					case '>':
						result = userValue > condition.value;
						break;
					case '>=':
						result = userValue >= condition.value;
						break;
					case '<':
						result = userValue < condition.value;
						break;
					case '<=':
						result = userValue <= condition.value;
						break;
					default:
						result = false;
				}

				console.log(
					`DEBUG: Condition check - ${condition.parameter} ${condition.operator} ${condition.value}, User value: ${userValue}, Result: ${result}`
				);
				return result;
			});

			console.log(`DEBUG: Perk "${perk.perkName}" eligible: ${isEligible}`);
			return isEligible;
		});

		console.log(`DEBUG: Total eligible perks: ${eligiblePerks.length}`);
		console.log('DEBUG: Eligible perks:', eligiblePerks);

		// Compare with current perks
		console.log('DEBUG: Current perks from API:', perks);
		console.log(`DEBUG: Current perks length: ${perks.length}`);

		if (perks.length > 0) {
			console.log('DEBUG: First perk details:', perks[0]);
		}

		return eligiblePerks;
	}

	async function fetchStats() {
		if (!$currentUser) {
			console.error('User is not authenticated');
			return;
		}

		console.log('Starting fetchStats(), currentUser:', $currentUser.id);
		loading = true;
		error = null;

		try {
			let endpoint = `/api/verify/users/${$currentUser.id}/stats`;

			if (projectId) {
				console.log('Fetching project-specific stats for projectId:', projectId);
				endpoint = `/api/verify/users/${$currentUser.id}/stats?projectId=${projectId}`;
			}

			console.log('Fetching stats from endpoint:', endpoint);

			// Fetch stats from API endpoint
			const response = await fetch(endpoint, {
				credentials: 'include'
			});

			console.log('Response status:', response.status);

			if (!response.ok) {
				throw new Error(`Failed to fetch stats: ${response.status}`);
			}

			const data = await response.json();
			console.log('Stats data received:', data);

			if (data.success) {
				threadCount = data.threadCount || 0;
				messageCount = data.messageCount || 0;
				taskCount = data.taskCount || 0;
				tagCount = data.tagCount || 0;
				await fetchTimerSessions();

				/*
				 * Don't overwrite timerCount if we have timer_sessions
				 * Only use API timerCount if we don't have local timer sessions
				 */
				if (!$currentUser?.timer_sessions || $currentUser.timer_sessions.length === 0) {
					timerCount = data.timerCount || 0;
				}
				// Otherwise, keep the calculated timerCount from reactive statement

				console.log('DEBUG: Perks from API:', data.perks);
				console.log('DEBUG: Perks type:', typeof data.perks, Array.isArray(data.perks));

				perks = data.perks || [];

				console.log('DEBUG: Perks after assignment:', perks);
				console.log('DEBUG: Perks length after assignment:', perks.length);

				if (data.lastActive) {
					lastActive = new Date(data.lastActive);
				}

				console.log('Stats updated:', {
					threadCount,
					messageCount,
					taskCount,
					tagCount,
					timerCount,
					lastActive,
					perks
				});

				checkPerksAgainstStats();
			} else {
				error = data.error || 'Unknown error in stats response';
				console.error('Error in stats response:', data.error);
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'Unknown error';
			error = errorMessage;
			console.error('Error fetching stats:', errorMessage);
		} finally {
			loading = false;
		}
	}

	function getEligiblePerksLocally(): Omit<Perk, 'id' | 'created' | 'updated' | 'achievedBy'>[] {
		console.log('Getting eligible perks locally with stats:', {
			threadCount,
			messageCount,
			taskCount,
			tagCount,
			timerCount // Add this
		});

		return PERKS.filter((perk) => {
			return perk.filterConditions.every((condition: PerkFilterCondition) => {
				let userValue = 0;

				switch (condition.parameter) {
					case 'messages':
						userValue = messageCount;
						break;
					case 'threads':
						userValue = threadCount;
						break;
					case 'tasks':
						userValue = taskCount;
						break;
					case 'tags':
						userValue = tagCount;
						break;
					case 'timer':
						break;
				}

				switch (condition.operator) {
					case '=':
						return userValue === condition.value;
					case '>':
						return userValue > condition.value;
					case '>=':
						return userValue >= condition.value;
					case '<':
						return userValue < condition.value;
					case '<=':
						return userValue <= condition.value;
					default:
						return false;
				}
			});
		});
	}

	async function checkAndUpdatePerks() {
		if (!$currentUser) {
			console.error('User is not authenticated');
			return;
		}

		checkingPerks = true;

		try {
			// Call API to update perks
			const response = await fetch(`/api/users/${$currentUser.id}/check-perks`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					threadCount,
					messageCount,
					taskCount,
					tagCount
				}),
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to check perks: ${response.status}`);
			}

			const data = await response.json();

			if (data.success) {
				console.log('Perks from API:', data.perks);

				if (data.perks && data.perks.length > 0) {
					perks = data.perks;
				} else {
					console.log('No perks from API, using local calculation');
					localPerks = getEligiblePerksLocally().map(createFullPerk);

					perks = localPerks;
				}

				console.log('Perks updated, new length:', perks.length);
			} else {
				throw new Error(data.error || 'Unknown error in perks response');
			}
		} catch (e) {
			console.error('Error checking perks:', e);

			// Fallback to local perks calculation
			console.log('Using local perks calculation due to API error');
			localPerks = getEligiblePerksLocally().map(createFullPerk);
			perks = localPerks;
		} finally {
			checkingPerks = false;
		}
	}

	function togglePerksPanel() {
		showPerksPanel = !showPerksPanel;

		// If opening the panel, check for new perks
		if (showPerksPanel && !checkingPerks) {
			checkAndUpdatePerks();
		}
	}
	async function fetchTimerSessions() {
		if (!$currentUser) return;

		const result = await fetchTryCatch<{
			success: boolean;
			sessions?: TimerSession[];
			totalDuration?: number;
		}>(`/api/users/${$currentUser.id}/tracking`, {
			credentials: 'include'
		});

		if (isSuccess(result)) {
			const data = result.data;

			if (data.success && data.sessions) {
				timerCount = data.totalDuration ?? calculateTotalTimerDuration(data.sessions);
				console.log('Timer sessions fetched:', data.sessions.length, 'Total seconds:', timerCount);
			} else {
				console.warn('Timer sessions response missing success flag or sessions');
			}
		} else {
			console.error('Error fetching timer sessions:', result.error);
		}
	}
	let tooltipVisible = false;
	let tooltipContent = '';
	let tooltipX = 0;
	let tooltipY = 0;

	function showTooltip(event: MouseEvent, content: string) {
		if (!content) return;

		tooltipContent = content;
		tooltipVisible = true;

		// Position the tooltip near the mouse
		updateTooltipPosition(event);

		// Add event listener for mouse movement
		document.addEventListener('mousemove', updateTooltipPosition);
	}

	function hideTooltip() {
		tooltipVisible = false;
		tooltipContent = '';

		// Remove event listener when tooltip is hidden
		document.removeEventListener('mousemove', updateTooltipPosition);
	}

	function updateTooltipPosition(event: MouseEvent) {
		// Position the tooltip a bit above and to the right of the cursor
		tooltipX = event.clientX + 15;
		tooltipY = event.clientY - 15;

		// Make sure the tooltip stays within viewport
		const tooltipElement = document.getElementById('tooltip');
		if (tooltipElement) {
			const tooltipWidth = tooltipElement.offsetWidth;
			const tooltipHeight = tooltipElement.offsetHeight;
			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;

			// Adjust X position if tooltip would go off the right edge
			if (tooltipX + tooltipWidth > windowWidth - 20) {
				tooltipX = windowWidth - tooltipWidth - 20;
			}

			// Adjust Y position if tooltip would go off the bottom edge
			if (tooltipY + tooltipHeight > windowHeight - 20) {
				tooltipY = windowHeight - tooltipHeight - 20;
			}
		}
	}

	function getNextPerkTarget(
		statValue: number,
		statType: 'messages' | 'threads' | 'tasks' | 'tags'
	): {
		value: number;
		perk: Omit<Perk, 'id' | 'created' | 'updated' | 'achievedBy'> | null;
		progress: number;
	} {
		const sortedIncrements = [...INCREMENTS].sort((a, b) => a - b);
		const nextTargetValue = sortedIncrements.find((inc) => inc > statValue);
		const targetValue = nextTargetValue || sortedIncrements[sortedIncrements.length - 1];

		const targetPerk =
			PERKS.find((perk) => {
				return (
					perk.filterConditions.length === 1 &&
					perk.filterConditions[0].parameter === statType &&
					perk.filterConditions[0].value === targetValue
				);
			}) || null;

		const previousTarget = sortedIncrements.filter((inc) => inc < targetValue).pop() || 0;
		const progressRange = targetValue - previousTarget;
		const progressValue = statValue - previousTarget;
		const progress = progressRange > 0 ? (progressValue / progressRange) * 100 : 100;

		return {
			value: targetValue,
			perk: targetPerk,
			progress: Math.min(Math.max(progress, 0), 100)
		};
	}
	function createFullPerk(
		partialPerk: Omit<Perk, 'id' | 'created' | 'updated' | 'achievedBy'>
	): Perk {
		return {
			...partialPerk,
			id: crypto.randomUUID(),
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			achievedBy: [],
			perkName: '',
			perkDescription: '',
			perkIcon: '',
			filterConditions: [],
			collectionId: '',
			collectionName: ''
		};
	}

	// Computed properties for next targets
	$: nextMessageTarget = getNextPerkTarget(messageCount, 'messages');
	$: nextThreadTarget = getNextPerkTarget(threadCount, 'threads');
	$: nextTaskTarget = getNextPerkTarget(taskCount, 'tasks');
	$: nextTagTarget = getNextPerkTarget(tagCount, 'tags');
	$: timerTarget = 3600;

	onMount(async () => {
		console.log('Component mounted with initial values:', {
			projectId,
			threadCount,
			messageCount,
			taskCount,
			tagCount,
			timerCount,
			lastActive,
			perks
		});
		await fetchTimerSessions();

		if (
			threadCount === 0 &&
			messageCount === 0 &&
			taskCount === 0 &&
			tagCount === 0 &&
			timerCount === 0
		) {
			console.log('No stats provided as props, fetching from API...');
			fetchStats();
		} else {
			console.log('Using stats provided as props');

			if (perks.length === 0) {
				localPerks = getEligiblePerksLocally().map(createFullPerk);
				perks = localPerks;
			}
		}
	});
	onDestroy(() => {
		document.removeEventListener('mousemove', updateTooltipPosition);
	});
</script>

{#if loading}
	<div class="spinner-container">
		<div class="spinner"></div>
	</div>
{:else}
	<div class="stats-container" transition:fade={{ duration: 200 }}>
		<div class="stat-item" style="--progress: {nextThreadTarget.progress}%">
			<div class="stat-label">
				<span class="stat-value">{formatNumber(threadCount)}</span>
				<span class="stat-name">{$t('dashboard.nameThreads')}</span>
			</div>
			<div
				class="target"
				class:target-reached={threadCount >= nextThreadTarget.value}
				on:mouseenter={(e) => showTooltip(e, nextThreadTarget.perk?.perkDescription || '')}
				on:mouseleave={hideTooltip}
			>
				<span class="target-value">{formatNumber(nextThreadTarget.value)}</span>
				<span class="target-icon">{nextThreadTarget.perk?.perkIcon || '✰'}</span>
			</div>
		</div>

		<!-- Message stats with next target and tooltip -->
		<div class="stat-item" style="--progress: {nextMessageTarget.progress}%">
			<div class="stat-label">
				<span class="stat-value">{formatNumber(messageCount)}</span>
				<span class="stat-name">{$t('dashboard.nameMessages')}</span>
			</div>
			<div
				class="target"
				class:target-reached={messageCount >= nextMessageTarget.value}
				on:mouseenter={(e) => showTooltip(e, nextMessageTarget.perk?.perkDescription || '')}
				on:mouseleave={hideTooltip}
			>
				<span class="target-value">{formatNumber(nextMessageTarget.value)}</span>
				<span class="target-icon">{nextMessageTarget.perk?.perkIcon || '✰'}</span>
			</div>
		</div>

		<!-- Task stats with next target and tooltip -->
		<div class="stat-item" style="--progress: {nextTaskTarget.progress}%">
			<div class="stat-label">
				<span class="stat-value">{formatNumber(taskCount)}</span>
				<span class="stat-name">{$t('dashboard.nameTasks')}</span>
			</div>
			<div
				class="target"
				class:target-reached={taskCount >= nextTaskTarget.value}
				on:mouseenter={(e) => showTooltip(e, nextTaskTarget.perk?.perkDescription || '')}
				on:mouseleave={hideTooltip}
			>
				<span class="target-value">{formatNumber(nextTaskTarget.value)}</span>
				<span class="target-icon">{nextTaskTarget.perk?.perkIcon || '✰'}</span>
			</div>
		</div>

		<!-- Tag stats with next target and tooltip -->
		<div class="stat-item" style="--progress: {nextTagTarget.progress}%">
			<div class="stat-label">
				<span class="stat-value">{formatNumber(tagCount)}</span>
				<span class="stat-name">{$t('dashboard.nameTags')}</span>
			</div>
			<div
				class="target"
				class:target-reached={tagCount >= nextTagTarget.value}
				on:mouseenter={(e) => showTooltip(e, nextTagTarget.perk?.perkDescription || '')}
				on:mouseleave={hideTooltip}
			>
				<span class="target-value">{formatNumber(nextTagTarget.value)}</span>
				<span class="target-icon">{nextTagTarget.perk?.perkIcon || '✰'}</span>
			</div>
		</div>

		<!-- Timer stats (no tooltip since there's no specific perk) -->
		<div class="stat-item" style="--progress: {calculatePercentage(timerCount, timerTarget)}%">
			<div class="stat-label">
				<span class="stat-value">{formatTimerCount(timerCount)}</span>
				<span class="stat-name">{$t('dashboard.nameTimer')}</span>
			</div>
			<div class="target">
				<span class="target-value">{Math.round(timerTarget / 3600)}h</span>
				<span class="target-icon">✰</span>
			</div>
		</div>
		<div class="perks-summary">
			<button class="perks-button" on:click={togglePerksPanel} class:checking={checkingPerks}>
				{checkingPerks
					? 'Checking...'
					: `${perks.length} ${$t('dashboard.perks')} ${showPerksPanel ? '▲' : '▼'}`}
			</button>
			<button class="refresh-perks" on:click={checkAndUpdatePerks} disabled={checkingPerks}>
				{checkingPerks ? '⟳' : '↻'}
			</button>
		</div>
		{#if showPerksPanel}
			<div class="perks-panel" transition:fade={{ duration: 200 }}>
				{#if perks.length === 0}
					<div class="no-perks">
						{checkingPerks
							? 'Checking for perks...'
							: 'No perks unlocked yet. Keep using the platform!'}
					</div>
				{:else}
					<div class="perks-grid">
						{#each perks as perk}
							<div class="perk-item">
								<div class="perk-icon">{perk.perkIcon}</div>
								<div class="perk-info">
									<div class="perk-name">{perk.perkName}</div>
									<div class="perk-description">{perk.perkDescription}</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="last-active">
			{$t('dashboard.nameActive')}
			{lastActive ? formatDate(lastActive.toString()) : 'Never'}
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.stats-container {
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
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
		flex-direction: column;
	}

	.loading {
		color: #aaa;
		font-size: 0.9rem;
		margin-top: 0.5rem;
	}

	.error {
		color: #ff5555;
		font-size: 0.9rem;
		margin-top: 0.5rem;
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

	.perks-button {
		background: rgba(1, 149, 137, 0.3);
		color: #ffffff;
		border: none;
		border-radius: 20px;
		padding: 8px 16px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;

		&.checking {
			opacity: 0.7;
			cursor: wait;
		}

		&:hover {
			background: rgba(1, 149, 137, 0.5);
		}
	}
	.refresh-perks {
		background: rgba(1, 149, 137, 0.3);
		color: #ffffff;
		border: none;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.3s ease;

		&:disabled {
			opacity: 0.5;
			cursor: wait;
			animation: spin 1s linear infinite;
		}

		&:hover:not(:disabled) {
			background: rgba(1, 149, 137, 0.5);
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.new-perks-badge {
		position: absolute;
		top: -8px;
		right: -8px;
		background: #ff6b6b;
		color: white;
		border-radius: 50%;
		width: 22px;
		height: 22px;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}

	.perks-summary {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
	}

	.no-perks {
		color: #aaaaaa;
		text-align: center;
		padding: 10px;
	}

	@keyframes highlight {
		0% {
			background: rgba(1, 149, 137, 0.1);
		}
		50% {
			background: rgba(1, 149, 137, 0.3);
		}
		100% {
			background: rgba(1, 149, 137, 0.1);
		}
	}

	.target {
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.3s ease;
		cursor: help;
		padding: 4px 8px;
		border-radius: 4px;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}

		&.target-reached {
			animation: pulse 2s infinite;
		}
	}

	.target-value {
		font-size: 0.85rem;
	}

	.target-icon {
		font-size: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.05);
			opacity: 0.9;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Tooltip styles */
	.tooltip {
		position: fixed;
		z-index: 100;
		background: rgba(0, 0, 0, 0.85);
		color: white;
		padding: 10px 14px;
		border-radius: 6px;
		font-size: 0.85rem;
		max-width: 250px;
		pointer-events: none;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.tooltip-title {
		font-weight: bold;
		font-size: 0.95rem;
		margin-bottom: 5px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.tooltip-icon {
		font-size: 1.2rem;
	}

	.tooltip-description {
		line-height: 1.4;
		opacity: 0.9;
	}

	.perks-summary {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
	}

	.perks-button {
		background: rgba(1, 149, 137, 0.3);
		color: #ffffff;
		border: none;
		border-radius: 20px;
		padding: 8px 16px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.3s ease;

		&.checking {
			opacity: 0.7;
			cursor: wait;
		}

		&:hover {
			background: rgba(1, 149, 137, 0.5);
		}
	}

	.refresh-perks {
		background: rgba(1, 149, 137, 0.3);
		color: #ffffff;
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.3s ease;

		&:disabled {
			opacity: 0.5;
			cursor: wait;
			animation: spin 1s linear infinite;
		}

		&:hover:not(:disabled) {
			background: rgba(1, 149, 137, 0.5);
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.perks-panel {
		// background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		padding: 15px;
		margin-top: 5px;
		background: var(--bg-gradient-r);
	}

	.no-perks {
		color: #aaaaaa;
		text-align: center;
		padding: 10px;
	}

	.perks-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		// grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 0.5rem;
	}

	.perk-item {
		display: flex;
		align-items: center;
		background-color: var(--tertiary-color);
		border-radius: 8px;
		padding: 0.25rem;
		height: 3rem;
		width: calc(50% - 2rem);
		transition:
			transform 0.2s ease,
			background 0.2s ease;

		&:hover {
			background: rgba(1, 149, 137, 0.2);
			.perk-info {
				display: flex;
				flex-direction: column;
			}
		}
	}

	.perk-icon {
		font-size: 1.5rem;
		margin-right: 15px;
		min-width: 40px;
		text-align: center;
	}

	.perk-info {
		flex: 1;
	}

	.perk-name {
		font-weight: bold;
		font-size: 0.8rem;

		color: #ffffff;
	}

	.perk-description {
		font-size: 0.6rem;
		color: #cccccc;
	}

	.last-active {
		color: #cccccc;
		text-align: right;
		font-size: 0.9em;
	}
</style>
