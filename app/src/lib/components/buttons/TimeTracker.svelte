<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import type { User } from '$lib/types/types';
	import { page } from '$app/stores';
	import { timerStore } from '$lib/stores/timerStore';
	import { browser } from '$app/environment';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';

	$: ({ isTracking, seconds, startTime } = $timerStore);

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
		timerStore.startTracking();
	}

async function stopAndSaveTracking() {
	if (!$currentUser) {
		timerStore.stopTracking();
		return;
	}

	const sessionData = timerStore.getCurrentSession();
	timerStore.stopTracking();

	if (sessionData && sessionData.duration > 0) {
		const result = await clientTryCatch((async () => {
			const fetchResult = await fetchTryCatch<any>(
				`/api/users/${$currentUser.id}/tracking`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(sessionData)
				}
			);

			if (isFailure(fetchResult)) {
				throw new Error(`Failed to save timer session: ${fetchResult.error}`);
			}

			const result = fetchResult.data;
			console.log('Timer session saved:', result);
			return result;
		})(), `Saving timer session for user ${$currentUser.id}`);

		if (isFailure(result)) {
			console.error('Error saving timer session:', result.error);
		}
	}
}

	async function handleBeforeUnload() {
		if (isTracking && $currentUser) {
			const sessionData = timerStore.getCurrentSession();
			if (sessionData && sessionData.duration > 0) {
				const data = JSON.stringify(sessionData);
				const blob = new Blob([data], { type: 'application/json' });

				navigator.sendBeacon(`/api/users/${$currentUser.id}/tracking`, blob);
			}
		}
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('beforeunload', handleBeforeUnload);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		}
	});
</script>

<div class="time-tracker" class:tracking={isTracking}>
	<button
		on:click={(event) => {
			event.stopPropagation();
			toggleTracking();
		}}
	>
		{#if isTracking}
			<span class="timer-icon">
				{@html getIcon('TimerOff', { size: 16 })}
			</span>
			<span class="timer"> Stop </span>
		{:else}
			<span class="timer-icon">
				{@html getIcon('Timer', { size: 16 })}
			</span>
			<span class="timer"> Start </span>
		{/if}
	</button>
	{#if isTracking}
		<span class="time-display">{timeDisplay}</span>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.time-tracker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 100%;
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
