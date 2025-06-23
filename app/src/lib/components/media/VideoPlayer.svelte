<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// Props
	export let src: string;
	export let mimeType: string;
	export let autoplay: boolean = true;
	export let showControls: boolean = true;
	export let loop: boolean = true;
	export let muted: boolean = true;
	export let threshold: number = 0.8; // How much of video must be visible to autoplay
	export let className: string = '';
	export let alternativeSources: Array<{ src: string; type: string }> = [];

	// State
	let videoElement: HTMLVideoElement;
	let videoContainer: HTMLDivElement;
	let intersectionObserver: IntersectionObserver;
	let isPlaying = false;
	let isMuted = muted;
	let showPlayButton = false;
	let isLoading = true;
	let autoplayTimeout: number | undefined;
	let hasCheckedSupport = false;

	function setupAutoplay() {
		if (!videoElement || !autoplay) return;

		intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach(async (entry) => {
					const video = entry.target as HTMLVideoElement;

					if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
						// Video is sufficiently visible - try autoplay
						if (video.paused) {
							try {
								// Ensure video is muted for autoplay
								video.muted = true;
								isMuted = true;

								// Pause other videos first
								const allVideos = document.querySelectorAll('video');
								allVideos.forEach((v) => {
									if (v !== video && !v.paused) {
										v.pause();
									}
								});

								// For MP4 files, add additional checks
								if (mimeType === 'video/mp4') {
									// Wait for video to be ready
									if (video.readyState < 2) {
										console.log('MP4 not ready, waiting...', src);

										const tryAutoplay = async () => {
											try {
												if (video.readyState >= 2) {
													await video.play();
													console.log('MP4 autoplay successful after waiting:', src);
												} else {
													showPlayButton = true;
												}
											} catch (err) {
												console.log('MP4 autoplay failed after waiting:', err);
												showPlayButton = true;
											}
										};

										video.addEventListener('loadeddata', tryAutoplay, { once: true });
										video.addEventListener('canplay', tryAutoplay, { once: true });

										setTimeout(() => {
											if (video.paused) {
												showPlayButton = true;
											}
										}, 2000);

										return;
									}
								}

								await video.play();
								console.log('Autoplay successful for:', src);
							} catch (err) {
								console.log('Autoplay failed:', err);

								// For MP4, try alternative approach
								if (mimeType === 'video/mp4') {
									console.log('Trying MP4 fallback approach...');
									// Set video to load and try again after a short delay
									video.load();
									setTimeout(async () => {
										try {
											await video.play();
											console.log('MP4 fallback autoplay successful:', src);
										} catch (fallbackErr) {
											console.log('MP4 fallback autoplay also failed:', fallbackErr);
											showPlayButton = true;
										}
									}, 500);
								} else {
									showPlayButton = true;
								}
							}
						}
					} else {
						// Video is not sufficiently visible - pause
						if (!video.paused) {
							video.pause();
						}
					}
				});
			},
			{
				threshold: [threshold],
				rootMargin: '0px'
			}
		);

		intersectionObserver.observe(videoElement);
	}

	function togglePlay() {
		if (!videoElement) return;

		if (videoElement.paused) {
			videoElement.play();
		} else {
			videoElement.pause();
		}
	}

	function toggleMute() {
		if (!videoElement) return;

		videoElement.muted = !videoElement.muted;
		isMuted = videoElement.muted;
	}

	function handlePlay() {
		isPlaying = true;
		showPlayButton = false;
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleLoadStart() {
		console.log('Video load started:', src);
		isLoading = true;
	}

	function handleCanPlay() {
		console.log('Video can play:', src);
		isLoading = false;
	}

	function handleError(event: Event) {
		const video = event.target as HTMLVideoElement;
		console.error('=== VIDEO ERROR ===');
		console.error('Video src:', src);
		console.error('Video MIME type:', mimeType);
		console.error('Error code:', video.error?.code);
		console.error('Error message:', video.error?.message);
		console.error('Network state:', video.networkState);
		console.error('Ready state:', video.readyState);
		console.error('=== END VIDEO ERROR ===');
		isLoading = false;
	}

	function handleLoadedData() {
		console.log('Video data loaded:', src);
		isLoading = false;
	}

	function handleVideoClick() {
		// Toggle play/pause on video click
		togglePlay();
	}

	function getBestVideoFormat() {
		const video = document.createElement('video');

		// Test format support
		const formats = [
			{ type: 'video/mp4', support: video.canPlayType('video/mp4; codecs="avc1.42E01E"') },
			{ type: 'video/webm', support: video.canPlayType('video/webm; codecs="vp9"') },
			{ type: 'video/quicktime', support: video.canPlayType('video/quicktime') }
		];

		// Sort by support level (probably > maybe > empty)
		formats.sort((a, b) => {
			const order = { probably: 3, maybe: 2, '': 1 };
			return (
				(order[b.support as keyof typeof order] || 1) -
				(order[a.support as keyof typeof order] || 1)
			);
		});

		console.log('Best supported format:', formats[0]);
		return formats[0].type;
	}

	function shouldPreferAlternativeFormat() {
		const userAgent = navigator.userAgent;
		const bestFormat = getBestVideoFormat();

		// Safari prefers MOV, Edge/Chrome prefer MP4
		if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
			return mimeType !== 'video/quicktime' && bestFormat === 'video/quicktime';
		}

		return mimeType !== bestFormat;
	}

	function checkVideoSupport() {
		if (hasCheckedSupport) return;
		hasCheckedSupport = true;

		const video = document.createElement('video');
		console.log('=== VIDEO SUPPORT CHECK ===');
		console.log('MP4 support:', video.canPlayType('video/mp4'));
		console.log('H.264 support:', video.canPlayType('video/mp4; codecs="avc1.42E01E"'));
		console.log('H.265 support:', video.canPlayType('video/mp4; codecs="hvc1"'));
		console.log('MOV support:', video.canPlayType('video/quicktime'));
		console.log('WebM support:', video.canPlayType('video/webm'));
		console.log('Current video src:', src);
		console.log('Current video MIME type:', mimeType);
		console.log('=== END VIDEO SUPPORT CHECK ===');
	}
	function setupCompatibleVideo() {
		if (!videoElement) return;

		// Try to play, if it fails, show manual play button
		videoElement.addEventListener('error', () => {
			console.log('Video failed to load, showing manual controls');
			showPlayButton = true;
			isLoading = false;
		});

		// Some videos need user interaction to play
		videoElement.addEventListener('loadstart', () => {
			if (mimeType === 'video/quicktime') {
				// MOV files often need manual trigger
				showPlayButton = true;
			}
		});
	}
	onMount(() => {
		// Check video support for debugging
		checkVideoSupport();

		// Setup autoplay with a small delay to ensure DOM is ready
		setTimeout(setupAutoplay, 100);
	});

	onDestroy(() => {
		if (intersectionObserver) {
			intersectionObserver.disconnect();
		}
		if (autoplayTimeout !== undefined) {
			clearTimeout(autoplayTimeout);
		}
	});
</script>

<div class="video-player-container {className}" bind:this={videoContainer}>
	<!-- Loading indicator -->
	{#if isLoading}
		<div class="video-loading">
			<div class="loading-spinner"></div>
		</div>
	{/if}

	<!-- Main video element -->
	<video
		bind:this={videoElement}
		class="video-element"
		{muted}
		{loop}
		playsinline
		preload={mimeType === 'video/mp4' ? 'auto' : 'metadata'}
		controls={showControls && !autoplay}
		on:play={handlePlay}
		on:pause={handlePause}
		on:loadstart={handleLoadStart}
		on:canplay={handleCanPlay}
		on:loadeddata={handleLoadedData}
		on:error={handleError}
		on:click={handleVideoClick}
	>
		<!-- Primary source -->
		<source {src} type={mimeType} />

		<!-- Alternative sources for better browser compatibility -->
		{#if alternativeSources && alternativeSources.length > 0}
			{#each alternativeSources as altSource}
				<source src={altSource.src} type={altSource.type} />
			{/each}
		{/if}

		<track kind="captions" />
		Your browser does not support the video tag.
	</video>

	<!-- Custom controls overlay (only shown for autoplay videos) -->
	{#if autoplay && showControls}
		<div class="video-controls-overlay">
			<!-- Play/Pause button -->
			{#if showPlayButton || !isPlaying}
				<button
					class="control-button play-button"
					on:click|stopPropagation={togglePlay}
					aria-label={isPlaying ? 'Pause' : 'Play'}
				>
					{#if isPlaying}
						{@html getIcon('Pause', { size: 24 })}
					{:else}
						{@html getIcon('Play', { size: 24 })}
					{/if}
				</button>
			{/if}

			<!-- Mute/Unmute button -->
			<div class="bottom-controls">
				<button
					class="control-button mute-button"
					on:click|stopPropagation={toggleMute}
					aria-label={isMuted ? 'Unmute' : 'Mute'}
				>
					{#if isMuted}
						{@html getIcon('VolumeX', { size: 20 })}
					{:else}
						{@html getIcon('Volume2', { size: 20 })}
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.video-player-container {
		position: relative;
		width: 100%;
		max-width: 450px;
		max-height: 800px;
		height: auto;
		border-radius: 8px;
		overflow: hidden;
		background: #000;
	}

	.video-element {
		width: 100%;
		height: auto;
		display: block;
		cursor: pointer;
	}

	.video-loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 2;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: #fff;
		animation: spin 1s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.video-controls-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		background: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0.1) 0%,
			transparent 30%,
			transparent 70%,
			rgba(0, 0, 0, 0.2) 100%
		);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.video-player-container:hover .video-controls-overlay {
		opacity: 1;
	}

	.control-button {
		pointer-events: auto;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.control-button:hover {
		background: rgba(0, 0, 0, 0.9);
		transform: scale(1.1);
	}

	.play-button {
		width: 60px;
		height: 60px;
	}

	.bottom-controls {
		position: absolute;
		bottom: 12px;
		right: 12px;
	}

	.mute-button {
		width: 40px;
		height: 40px;
	}

	/* Hide controls on very small screens */
	@media (max-width: 480px) {
		.play-button {
			width: 50px;
			height: 50px;
		}

		.mute-button {
			width: 35px;
			height: 35px;
		}
	}
</style>
