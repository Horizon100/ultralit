<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Timer, TimerOff } from 'lucide-svelte';
	import { currentUser } from '$lib/pocketbase';
	import type { User } from '$lib/types/types';
	import { page } from '$app/stores';

	let isTracking = false;
	let seconds = 0;
	let interval: ReturnType<typeof setInterval> | null = null;
	let startTime: Date;

	$: hours = Math.floor(seconds / 3600);
	$: minutes = Math.floor((seconds % 3600) / 60);
	$: remainingSeconds = seconds % 60;

	$: timeDisplay = [
		hours.toString().padStart(2, '0'),
		minutes.toString().padStart(2, '0'),
		remainingSeconds.toString().padStart(2, '0')
	].join(':');
	$: currentPath = $page.route.id || $page.url.pathname;

	async function toggleTracking() {
		if (isTracking) {
			await stopAndSaveTracking();
		} else {
			startTracking();
		}
	}

	function startTracking() {
		isTracking = true;
		startTime = new Date();
		interval = setInterval(() => {
			seconds++;
		}, 1000);
	}

	async function stopAndSaveTracking() {
		isTracking = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}

		const endTime = new Date();
		const duration = seconds;

		if ($currentUser && duration > 0) {
			try {
				const timerSession = {
					date: startTime.toISOString().split('T')[0],
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
					duration: duration,
					path: currentPath

				};

				const response = await fetch(`/api/users/${$currentUser.id}/tracking`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(timerSession)
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
				}

				const result = await response.json();
				console.log('Timer session saved:', result);


			} catch (error) {
				console.error('Error saving timer session:', error);
			}
		}

		seconds = 0;
	}

	onDestroy(async () => {
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
		if (isTracking) {
			await stopAndSaveTracking();
		}
	});
</script>

<div class="time-tracker" class:tracking={isTracking}>
	<button on:click={(event) => {
		event.stopPropagation();
		toggleTracking();
	}}>
		{#if isTracking}
			<span class="timer-icon">
				<TimerOff size={16} />
			</span>
			<span class="timer">
				Stop
			</span>
		{:else}
			<span class="timer-icon">
				<Timer size={16} />
			</span>
			<span class="timer">
				Start
			</span>
		{/if}
	</button>
	{#if isTracking}
		<span class="time-display">{timeDisplay}</span>
	{/if}
</div>
<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.time-tracker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: auto;
		gap: 0.5rem !important;
		transition: width 0.3s ease;
		& span.timer {
			display: none;
			font-size: 0.7rem;
		}
		&:hover {
			& span.timer {
				display: flex;
			}
			& span.timer-icon {
				display: none;
			}
		}
	}

	.time-tracker.tracking {
		justify-content: space-between;
		height: 2rem;
	}

	button {
		color: var(--text-color);
		background: transparent;
		font-size: 1rem;
		border: none;
		cursor: pointer;
		border-radius: 0.5rem;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 10;
		transition: all 0.3s ease-in-out;
		overflow: hidden;
		user-select: none;
	}

	button:hover {
		background-color: #c0392b !important;
	}

	.time-display {
		font-size: 0.6rem;
		color: var(--text-color);
	}
</style>
