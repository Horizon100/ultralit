<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import {
		initAudioState,
		registerAudioElement,
		getAudioStatesStore,
		togglePlayPause,
		handleAudioLoaded,
		handleTimeUpdate,
		handleAudioEnded,
		handleProgressChange,
		handleVolumeChange,
		toggleMute,
		formatTime,
		cleanupAudioPlayer,
		pauseOtherAudioPlayers
	} from '$lib/utils/mediaHandlers';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let attachmentId: string;
	export let audioSrc: string;
	export let mimeType: string;
	export let fileName: string;
	$: console.log('🎵 AudioPlayer received props:', { attachmentId, audioSrc, mimeType, fileName });

	let audioElement: HTMLAudioElement;
	let isDragging = false;
	let volumeDragging = false;
	let showSpeedMenu = false;
	let currentSpeed = 1;

	const audioStatesStore = getAudioStatesStore();

	// Initialize audio state when component mounts
	onMount(() => {
		initAudioState(attachmentId);
		if (audioElement) {
			registerAudioElement(attachmentId, audioElement);
			// Set up audio loading
			setupAudioElement();
		}

		// Add global click handler for closing speed menu
		document.addEventListener('click', handleClickOutside);
	});

	// Setup audio element with better duration handling
	function setupAudioElement() {
		if (!audioElement) return;

		// Set preload to auto to ensure metadata is loaded
		audioElement.preload = 'auto';

		// Force load if not already loading
		if (audioElement.readyState === 0) {
			audioElement.load();
		}

		// Try to get duration immediately if available
		updateDuration();

		// Set up a polling mechanism to check for duration
		const durationCheckInterval = setInterval(() => {
			if (
				audioElement.duration &&
				!isNaN(audioElement.duration) &&
				isFinite(audioElement.duration)
			) {
				updateDuration();
				clearInterval(durationCheckInterval);
			}
		}, 100);

		// Clear interval after 5 seconds to prevent infinite polling
		setTimeout(() => {
			clearInterval(durationCheckInterval);
		}, 5000);
	}

	// Update duration in store
	function updateDuration() {
		if (!audioElement) return;

		const duration = audioElement.duration;
		if (duration && !isNaN(duration) && isFinite(duration)) {
			audioStatesStore.update((states) => {
				const state = states[attachmentId];
				if (state) {
					state.duration = duration;
				}
				return states;
			});
		}
	}

	// Cleanup when component unmounts
	onDestroy(() => {
		cleanupAudioPlayer(attachmentId);
		document.removeEventListener('click', handleClickOutside);
	});

	// Reactive statements for audio state
	$: audioState = $audioStatesStore[attachmentId] || {
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		volume: 1,
		isMuted: false
	};

	// Handle play/pause button click
	function handlePlayPause() {
		if (audioState.isPlaying) {
			pauseOtherAudioPlayers(attachmentId);
		}
		togglePlayPause(attachmentId);
	}

	// Handle mute button click
	function handleMuteClick() {
		toggleMute(attachmentId);
	}

	// Handle progress bar click/drag
	function handleProgressClick(event: MouseEvent) {
		if (!audioElement || audioState.duration === 0) return;

		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		const width = rect.width;
		const newTime = (x / width) * audioState.duration;

		audioElement.currentTime = newTime;

		// Update the state immediately for visual feedback
		audioStatesStore.update((states) => {
			const state = states[attachmentId];
			if (state) {
				state.currentTime = newTime;
			}
			return states;
		});
	}
	function handleProgressKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			if (!audioElement || audioState.duration === 0) return;

			// Simple implementation: jump to middle on Enter
			const newTime = audioState.duration / 2;
			audioElement.currentTime = newTime;

			audioStatesStore.update((states) => {
				const state = states[attachmentId];
				if (state) {
					state.currentTime = newTime;
				}
				return states;
			});
		}
	}
	// Handle volume slider change
	function handleVolumeSliderChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const volume = parseFloat(target.value);
		console.log('Volume slider changed:', volume);
		handleVolumeChange(attachmentId, event);
	}

	// Handle playback speed change
	function handleSpeedChange(speed: number) {
		if (audioElement) {
			audioElement.playbackRate = speed;
			currentSpeed = speed;
		}
		showSpeedMenu = false;
	}

	// Toggle speed menu
	function toggleSpeedMenu() {
		showSpeedMenu = !showSpeedMenu;
	}

	// Close speed menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.speed-control')) {
			showSpeedMenu = false;
		}
	}

	// Calculate progress percentage
	$: progressPercentage =
		audioState.duration > 0 ? (audioState.currentTime / audioState.duration) * 100 : 0;

	// Calculate volume percentage for visual indicator
	$: volumePercentage = audioState.isMuted
		? 0
		: Math.max(0, Math.min(100, audioState.volume * 100));

	/*
	 * Debug volume
	 * $: {
	 * 	console.log('Volume debug:', {
	 * 		volume: audioState.volume,
	 * 		isMuted: audioState.isMuted,
	 * 		volumePercentage: volumePercentage
	 * 	});
	 * }
	 */

	/*
	 * Debug progress
	 * $: {
	 * 	if (audioState.currentTime > 0 || audioState.duration > 0) {
	 * 		console.log('Progress debug:', {
	 * 			currentTime: audioState.currentTime,
	 * 			duration: audioState.duration,
	 * 			progressPercentage: progressPercentage
	 * 		});
	 * 	}
	 * }
	 */
</script>

<!-- Enhanced debug version of audio element -->
<audio
	bind:this={audioElement}
	preload="auto"
	on:loadstart={() => console.log('🎵 Audio loadstart:', audioSrc)}
	on:loadedmetadata={() => {
		console.log('🎵 Audio loadedmetadata:', {
			duration: audioElement?.duration,
			readyState: audioElement?.readyState,
			networkState: audioElement?.networkState
		});
		handleAudioLoaded(attachmentId);
		updateDuration();
	}}
	on:loadeddata={() => {
		console.log('🎵 Audio loadeddata');
		handleAudioLoaded(attachmentId);
		updateDuration();
	}}
	on:canplay={() => console.log('🎵 Audio canplay')}
	on:canplaythrough={() => {
		console.log('🎵 Audio canplaythrough');
		handleAudioLoaded(attachmentId);
		updateDuration();
	}}
	on:timeupdate={() => handleTimeUpdate(attachmentId)}
	on:ended={() => handleAudioEnded(attachmentId)}
	on:play={() => {
		console.log('🎵 Audio play event');
		pauseOtherAudioPlayers(attachmentId);
	}}
	on:pause={() => console.log('🎵 Audio pause event')}
	on:error={(e) => {
		console.error('🎵 Audio error:', e);
		console.error('🎵 Audio error details:', {
			error: audioElement?.error,
			networkState: audioElement?.networkState,
			readyState: audioElement?.readyState,
			src: audioSrc
		});
	}}
	on:stalled={() => console.log('🎵 Audio stalled')}
	on:suspend={() => console.log('🎵 Audio suspend')}
	on:abort={() => console.log('🎵 Audio abort')}
	on:emptied={() => console.log('🎵 Audio emptied')}
	on:durationchange={() => {
		console.log('🎵 Audio durationchange:', audioElement?.duration);
		updateDuration();
	}}
	on:progress={() => {
		console.log('🎵 Audio progress');
		updateDuration();
	}}
	on:waiting={() => console.log('🎵 Audio waiting')}
	on:seeking={() => console.log('🎵 Audio seeking')}
	on:seeked={() => console.log('🎵 Audio seeked')}
>
	<source src={audioSrc} type={mimeType} />
	Your browser does not support the audio element.
</audio>

<!-- Add debug info to the UI temporarily -->
<!-- <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-size: 12px; border-radius: 4px;">
	<strong>Debug Info:</strong><br>
	Source: {audioSrc}<br>
	MIME Type: {mimeType}<br>
	Audio Element Ready State: {audioElement?.readyState || 'Not loaded'}<br>
	Audio Element Network State: {audioElement?.networkState || 'Not loaded'}<br>
	Audio Element Error: {audioElement?.error?.message || 'None'}<br>
	Duration: {audioElement?.duration || 'Unknown'}<br>
	Can Play: {audioElement?.readyState >= 3 ? 'Yes' : 'No'}
</div> -->

<!-- Custom Audio Player UI -->
<div class="custom-audio-player">
	<!-- File info -->
	<div class="audio-info">
		<div class="audio-title">{fileName}</div>
		<div class="audio-duration">
			{formatTime(audioState.currentTime)} / {formatTime(audioState.duration || 0)}
		</div>
	</div>

	<!-- Progress bar -->
	<div class="progress-container">
		<div
			class="progress-bar"
			role="button"
			tabindex="0"
			on:click={handleProgressClick}
			on:keydown={handleProgressKeydown}
		>
			<div class="progress-background"></div>
			<div
				class="progress-fill"
				style="width: {Math.max(0, Math.min(100, progressPercentage))}%"
			></div>
			<div
				class="progress-thumb"
				style="left: {Math.max(0, Math.min(100, progressPercentage))}%"
			></div>
		</div>
	</div>

	<!-- Controls -->
	<div class="audio-controls">
		<!-- Play/Pause Button -->
		<button class="control-btn play-pause" on:click={handlePlayPause}>
			{#if audioState.isPlaying}
				<Icon name="Pause" size={20} />
			{:else}
				<Icon name="Play" size={20} />
			{/if}
		</button>

		<!-- Volume Controls -->
		<div class="volume-controls">
			<button class="control-btn volume-btn" on:click={handleMuteClick}>
				{#if audioState.isMuted || audioState.volume === 0}
					<Icon name="VolumeX" size={16} />
				{:else}
					<Icon name="Volume2" size={16} />
				{/if}
			</button>

			<div class="volume-slider-container">
				<div class="volume-track"></div>
				<div class="volume-fill" style="width: {volumePercentage}%"></div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={audioState.isMuted ? 0 : audioState.volume}
					class="volume-slider"
					on:input={handleVolumeSliderChange}
				/>
			</div>
		</div>

		<!-- Playback Speed Control -->
		<div class="speed-control">
			<button class="control-btn speed-btn" on:click={toggleSpeedMenu}>
				<Icon name="Settings" size={16} />
				<span class="speed-label">{currentSpeed}x</span>
			</button>

			{#if showSpeedMenu}
				<div class="speed-menu">
					{#each [0.5, 0.75, 1, 1.25, 1.5, 2] as speed}
						<button
							class="speed-option"
							class:active={currentSpeed === speed}
							on:click={() => handleSpeedChange(speed)}
						>
							{speed}x
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.custom-audio-player {
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 16px;
		margin: 8px 0;
		width: 100%;
		max-width: 400px;
	}

	.audio-info {
		margin-bottom: 12px;
	}

	.audio-title {
		font-weight: 500;
		color: var(--text-color);
		font-size: 0.9rem;
		margin-bottom: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: none;
	}

	.audio-duration {
		font-size: 0.8rem;
		color: var(--placeholder-color);
	}

	.progress-container {
		margin-bottom: 12px;
	}

	.progress-bar {
		position: relative;
		height: 6px;
		border-radius: 3px;
		cursor: pointer;
		transition: height 0.2s ease;
		overflow: hidden;
	}

	.progress-bar:hover {
		height: 8px;
	}

	.progress-background {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: var(--line-color);
		border-radius: 3px;
	}

	.progress-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		background: var(--accent-color);
		border-radius: 3px;
		transition: width 0.1s ease;
		z-index: 1;
	}

	.progress-thumb {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		background: var(--accent-color);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		opacity: 0;
		transition: opacity 0.2s ease;
		z-index: 2;
	}

	.progress-bar:hover .progress-thumb {
		opacity: 1;
	}

	.audio-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.control-btn {
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		border-radius: 50%;
		transition: background-color 0.2s ease;
	}

	.control-btn:hover {
		background: var(--line-color);
	}

	.play-pause {
		background: var(--accent-color);
		color: var(--text-color);
		padding: 12px;
	}

	.play-pause:hover {
		background: var(--accent-color);
		opacity: 0.9;
	}

	.volume-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.volume-slider-container {
		position: relative;
		flex: 1;
		max-width: 80px;
		height: 20px;
		display: flex;
		align-items: center;
	}

	.volume-track {
		position: absolute;
		top: 50%;
		left: 0;
		width: 100%;
		height: 4px;
		background: var(--line-color);
		border-radius: 2px;
		transform: translateY(-50%);
		z-index: 0;
	}

	.volume-slider {
		width: 100%;
		height: 4px;
		background: transparent;
		outline: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
		position: relative;
		z-index: 2;
	}

	.volume-slider::-webkit-slider-track {
		height: 4px;
		background: transparent;
		border-radius: 2px;
	}

	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--accent-color);
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s ease;
	}

	.volume-slider:hover::-webkit-slider-thumb {
		transform: scale(1.1);
	}

	.volume-slider::-moz-range-track {
		height: 4px;
		background: transparent;
		border-radius: 2px;
		border: none;
	}

	.volume-slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--accent-color);
		border-radius: 50%;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s ease;
	}

	.volume-slider:hover::-moz-range-thumb {
		transform: scale(1.1);
	}

	.volume-fill {
		position: absolute;
		top: 50%;
		left: 0;
		height: 4px;
		background: var(--accent-color);
		border-radius: 2px;
		pointer-events: none;
		transition: width 0.1s ease;
		transform: translateY(-50%);
		z-index: 1;
	}

	/* Speed Control Styles */
	.speed-control {
		position: relative;
	}

	.speed-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 0.8rem;
	}

	.speed-label {
		font-size: 0.75rem;
		font-weight: 500;
	}

	.speed-menu {
		position: absolute;
		bottom: 100%;
		right: 0;
		background: var(--secondary-color);
		border: 1px solid var(--line-color);
		border-radius: 8px;
		padding: 4px;
		margin-bottom: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 10;
		min-width: 60px;
	}

	.speed-option {
		display: block;
		width: 100%;
		background: none;
		border: none;
		color: var(--text-color);
		padding: 6px 12px;
		text-align: center;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.8rem;
		transition: background-color 0.2s ease;
	}

	.speed-option:hover {
		background: var(--line-color);
	}

	.speed-option.active {
		background: var(--accent-color);
		color: var(--text-color);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.custom-audio-player {
			max-width: 100%;
		}

		.volume-slider-container {
			max-width: 60px;
		}

		.audio-controls {
			gap: 8px;
		}

		.speed-menu {
			right: auto;
			left: 0;
		}
	}
</style>
