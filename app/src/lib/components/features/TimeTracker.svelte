<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Timer, TimerOff } from 'lucide-svelte';
	import { pb, currentUser } from '$lib/pocketbase';
	import type { User } from '$lib/types/types';

	let isTracking = false;
	let seconds = 0;
	let interval: number;
	let startTime: Date;

	$: hours = Math.floor(seconds / 3600);
	$: minutes = Math.floor((seconds % 3600) / 60);
	$: remainingSeconds = seconds % 60;

	$: timeDisplay = [
		hours.toString().padStart(2, '0'),
		minutes.toString().padStart(2, '0'),
		remainingSeconds.toString().padStart(2, '0')
	].join(':');

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
		clearInterval(interval);

		const endTime = new Date();
		const duration = seconds;

		if ($currentUser) {
			try {
				const timerSession = {
					date: startTime.toISOString().split('T')[0],
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
					duration: duration
				};

				const currentSessions = $currentUser.timer_sessions || [];
				const updatedUser = await pb.collection('users').update<User>($currentUser.id, {
					timer_sessions: [...currentSessions, timerSession]
				});

				$currentUser = updatedUser;
				console.log('Timer session saved:', timerSession);
			} catch (error) {
				console.error('Error saving timer session:', error);
			}
		}

		seconds = 0; // Reset the timer after saving
	}

	onDestroy(async () => {
		if (interval) clearInterval(interval);
		if (isTracking) {
			await stopAndSaveTracking();
		}
	});
</script>

<div class="time-tracker" class:tracking={isTracking}>
	<button on:click={toggleTracking}>
		{#if isTracking}
			<TimerOff size={20} />
		{:else}
			<Timer size={20} />
		{/if}
	</button>
	{#if isTracking}
		<span class="time-display">{timeDisplay}</span>
	{/if}
</div>

<style>
	.time-tracker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: auto;
		width: auto;
		transition: width 0.3s ease;
	}

	.time-tracker.tracking {
		justify-content: space-between;
		height: 40px;
	}

	button {
		color: var(--text-color);
		background: var(--bg-gradient-right);
		font-size: 16px;
		border: none;
		cursor: pointer;
		border-radius: 12px;
		display: flex;
		justify-content: center;
		align-items: center;

		padding: 0.5rem;
		transition: all 0.3s ease-in-out;
		overflow: hidden;
		user-select: none;
	}

	button:hover {
		background-color: #c0392b;
	}

	.time-display {
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.6rem;
		color: #ecf0f1;
	}
</style>
