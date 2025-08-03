<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import DetectionOverlay from '$lib/features/ml/cv/components/DetectionOverlay.svelte';
	import DetectionControls from '$lib/features/ml/cv/components/DetectionControls.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { Detection, DetectionSettings } from '$lib/types/types.ml';
	import { cvApi } from '$lib/features/ml/cv/utils/cvApi';
	import { videoFrameToBase64, debounce } from '$lib/features/ml/cv/utils/detectionUtils';
	import PerformanceMonitor from '$lib/features/ml/cv/components/DetectionMonitor.svelte';
	import {
		DetectionAggregator,
		updateVideoAttachmentTags
	} from '$lib/features/ml/cv/utils/detectionTagging';

	// Original VideoPlayer props
	export let src: string;
	export let mimeType: string;
	export let autoplay: boolean = true;
	export let showControls: boolean = true;
	export let loop: boolean = true;
	export let muted: boolean = true;
	export let threshold: number = 0.8;
	export let className: string = '';
	export let alternativeSources: Array<{ src: string; type: string }> = [];

	// ML Detection props
	export let enableMLDetection: boolean = false;
	export let showMLControls: boolean = true;
	export let showPerformanceMonitor: boolean = false;
	export let attachmentId: string = '';
	export let postId: string = '';
	export let autoTagging: boolean = false;
	export let minTaggingConfidence: number = 0.7;
	export let onTagsUpdated: ((tags: any[]) => void) | undefined = undefined;

	// Original VideoPlayer state
	let videoElement: HTMLVideoElement;
	let videoContainer: HTMLDivElement;
	let intersectionObserver: IntersectionObserver;
	let isPlaying = false;
	let isMuted = muted;
	let showPlayButton = false;
	let isLoading = true;
	let autoplayTimeout: number | undefined;
	let hasCheckedSupport = false;

	// ML Detection state
	let detections: Detection[] = [];
	let mlSettings: DetectionSettings = {
		enabled: false,
		confidence: 0.5,
		model: 'yolov8n',
		frameSkip: 3,
		showLabels: true,
		showConfidence: true
	};
	let isProcessing = false;
	let frameCounter = 0;
	let detectionInterval: ReturnType<typeof setInterval> | undefined;
	let performanceMonitor: PerformanceMonitor | undefined;
	let detectionAggregator: DetectionAggregator | undefined;
	let lastTagUpdate = 0;
	let tagUpdateInterval: ReturnType<typeof setInterval> | undefined;
	$: if (enableMLDetection === true) {
		mlSettings.enabled = false;
	} else if (enableMLDetection === false) {
		mlSettings.enabled = false;
	}
	const debouncedDetection = debounce(async (videoEl: unknown) => {
		if (!(videoEl instanceof HTMLVideoElement)) {
			console.error('Invalid video element passed to debouncedDetection');
			return;
		}

		if (!mlSettings.enabled || isProcessing || !videoEl || videoEl.paused) {
			return;
		}

		try {
			isProcessing = true;

			performanceMonitor?.startProcessing();

			const frameData = videoFrameToBase64(videoEl, 0.7);

			console.log('=== FRONTEND DEBUG ===');
			console.log('Frame data length:', frameData.length);
			console.log('Frame data starts with:', frameData.substring(0, 50));
			console.log('Has data URL prefix:', frameData.includes('data:image'));

			const frameWithoutPrefix = frameData.split(',')[1];
			console.log('Frame without prefix length:', frameWithoutPrefix?.length || 'undefined');

			const requestPayload = {
				frame: frameWithoutPrefix,
				confidence: mlSettings.confidence,
				timestamp: Date.now()
			};

			console.log('Sending payload:', {
				frameLength: requestPayload.frame?.length || 'undefined',
				confidence: requestPayload.confidence,
				timestamp: requestPayload.timestamp
			});

			// Send to ML API
			const result = await cvApi.detectObjects(requestPayload);

			// Update detections
			detections = result.detections || [];
			if (autoTagging && detectionAggregator && detections.length > 0) {
				console.log(
					'🔍 Adding detections to aggregator:',
					detections.map((d) => ({
						class_name: d.class_name,
						confidence: d.confidence
					}))
				);
				detectionAggregator.addDetections(detections);
			} else if (autoTagging) {
				console.log('🚫 Not adding to aggregator - missing requirements');
			}
			// End performance tracking
			performanceMonitor?.endProcessing();

			console.log('Detection successful, found:', detections.length, 'objects');
		} catch (error) {
			console.error('Detection failed:', error);
			detections = [];
		} finally {
			isProcessing = false;
		}
	}, 200);
	function startTagUpdates() {
		if (tagUpdateInterval) return;

		tagUpdateInterval = setInterval(async () => {
			await updateTagsFromDetections();
		}, 5000); // Update every 5 seconds
	}

	function stopTagUpdates() {
		if (tagUpdateInterval) {
			clearInterval(tagUpdateInterval);
			tagUpdateInterval = undefined;
		}

		if (detectionAggregator) {
			setTimeout(() => updateTagsFromDetections(true), 1000);
		}
	}

	async function updateTagsFromDetections(isFinal: boolean = false) {
		if (!detectionAggregator || !attachmentId || !postId) return;

		const now = Date.now();

		if (!isFinal && now - lastTagUpdate < 3000) return;

		try {
			const tags = detectionAggregator.generateTags();

			if (tags.length > 0) {
				console.log(
					'🎥 Updating video tags:',
					tags.map((t) => t.name)
				);

				const result = await updateVideoAttachmentTags(attachmentId, postId, tags, {
					append: false,
					includeMetadata: true
				});

				if (result.success) {
					lastTagUpdate = now;
					onTagsUpdated?.(tags);
					console.log('✅ Video tags updated successfully');
				}
			}
		} catch (error) {
			console.error('❌ Failed to update video tags:', error);
		}
	}
	function startMLDetection() {
		if (!videoElement || detectionInterval) return;

		console.log('🎥 Starting ML Detection with tagging config:', {
			autoTagging,
			attachmentId,
			postId,
			minTaggingConfidence
		});

		// Initialize detection aggregator if auto-tagging is enabled
		if (autoTagging && attachmentId && postId) {
			console.log('🏷️ Initializing detection aggregator...');
			detectionAggregator = new DetectionAggregator({
				minConfidence: minTaggingConfidence,
				minDetectionCount: 5,
				maxTags: 8,
				aggregationWindow: 10000
			});

			startTagUpdates();
			console.log('✅ Detection aggregator initialized');
		} else {
			console.log('🚫 Auto-tagging disabled or missing IDs:', {
				autoTagging,
				hasAttachmentId: !!attachmentId,
				hasPostId: !!postId
			});
		}

		detectionInterval = setInterval(() => {
			frameCounter++;
			if (frameCounter % mlSettings.frameSkip === 0) {
				debouncedDetection(videoElement);
			}
		}, 100);
	}
	function stopMLDetection() {
		if (detectionInterval) {
			clearInterval(detectionInterval);
			detectionInterval = undefined;
		}

		stopTagUpdates();

		detections = [];
		frameCounter = 0;
	}

	function handleMLSettingsChange(event: CustomEvent<DetectionSettings>) {
		mlSettings = event.detail;

		if (mlSettings.enabled && isPlaying) {
			startMLDetection();
		} else {
			stopMLDetection();
		}
	}

	function handleToggleDetection(event: CustomEvent<boolean>) {
		const enabled = event.detail;

		if (enabled && isPlaying) {
			startMLDetection();
		} else {
			stopMLDetection();
		}
	}

// Original VideoPlayer functions
function setupAutoplay() {
	if (!videoElement || !autoplay) return;

	intersectionObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach(async (entry) => {
				const video = entry.target as HTMLVideoElement;

				if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
					if (video.paused) {
						try {
							video.muted = true;
							isMuted = true;

							const allVideos = document.querySelectorAll('video');
							allVideos.forEach((v) => {
								if (v !== video && !v.paused) {
									v.pause();
								}
							});

							if (mimeType === 'video/mp4') {
								if (video.readyState < 2) {
									console.log('MP4 not ready, waiting...', src);

									const tryAutoplay = async () => {
										try {
											if (video.readyState >= 2) {
												await video.play();
												console.log('MP4 autoplay successful after waiting:', src);
											} else {
												console.log('MP4 still not ready, showing play button:', src);
												showPlayButton = true;
											}
										} catch (err) {
											console.log('MP4 autoplay failed after waiting:', err);
											showPlayButton = true;
										}
									};

									// Remove any existing listeners to prevent duplicates
									video.removeEventListener('loadeddata', tryAutoplay);
									video.removeEventListener('canplay', tryAutoplay);
									
									// Add fresh listeners
									video.addEventListener('loadeddata', tryAutoplay, { once: true });
									video.addEventListener('canplay', tryAutoplay, { once: true });

									// Fallback timeout - reduced to 1 second for better UX
									setTimeout(() => {
										if (video.paused && video.readyState < 2) {
											console.log('MP4 loading timeout, showing play button:', src);
											showPlayButton = true;
											// Clean up listeners
											video.removeEventListener('loadeddata', tryAutoplay);
											video.removeEventListener('canplay', tryAutoplay);
										}
									}, 1000);

									return;
								}
							}

							await video.play();
							console.log('Autoplay successful for:', src);
						} catch (err) {
							console.log('Autoplay failed:', err);

							if (mimeType === 'video/mp4') {
								console.log('Trying MP4 fallback approach...');
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

		// Start ML detection if enabled
		if (mlSettings.enabled) {
			startMLDetection();
		}
	}

	function handlePause() {
		isPlaying = false;

		// Stop ML detection
		stopMLDetection();
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
		togglePlay();
	}

	function getBestVideoFormat() {
		const video = document.createElement('video');

		const formats = [
			{ type: 'video/mp4', support: video.canPlayType('video/mp4; codecs="avc1.42E01E"') },
			{ type: 'video/webm', support: video.canPlayType('video/webm; codecs="vp9"') },
			{ type: 'video/quicktime', support: video.canPlayType('video/quicktime') }
		];

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

		videoElement.addEventListener('error', () => {
			console.log('Video failed to load, showing manual controls');
			showPlayButton = true;
			isLoading = false;
		});

		videoElement.addEventListener('loadstart', () => {
			if (mimeType === 'video/quicktime') {
				showPlayButton = true;
			}
		});
	}
	if (autoTagging && detectionAggregator && detections.length > 0) {
		detectionAggregator.addDetections(detections);
	}
	onMount(() => {
		checkVideoSupport();
		setTimeout(setupAutoplay, 100);
	});

	onDestroy(() => {
		if (intersectionObserver) {
			intersectionObserver.disconnect();
		}
		if (autoplayTimeout !== undefined) {
			clearTimeout(autoplayTimeout);
		}
		stopMLDetection();
		stopTagUpdates();
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
		crossorigin="anonymous"
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
		<source {src} type={mimeType} />

		{#if alternativeSources && alternativeSources.length > 0}
			{#each alternativeSources as altSource}
				<source src={altSource.src} type={altSource.type} />
			{/each}
		{/if}

		<track kind="captions" />
		Your browser does not support the video tag.
	</video>

	<!-- ML Detection Overlay -->
	{#if mlSettings.enabled && videoElement}
		<DetectionOverlay
			{detections}
			{videoElement}
			showLabels={mlSettings.showLabels}
			showConfidence={mlSettings.showConfidence}
		/>
	{/if}
	{#if showPerformanceMonitor && mlSettings.enabled}
		<div class="performance-monitor-container">
			<PerformanceMonitor
				bind:this={performanceMonitor}
				isVisible={true}
				{isProcessing}
				detectionCount={detections.length}
			/>
		</div>
	{/if}
	<!-- Custom controls overlay -->
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
						<Icon name="Pause" size={24} />
					{:else}
						<Icon name="Play" size={24} />
					{/if}
				</button>
			{/if}

			<!-- Bottom controls -->
			<div class="bottom-controls">
				<!-- ML Detection Controls -->
				{#if showMLControls}
					<div class="ml-controls-container">
						<DetectionControls
							bind:settings={mlSettings}
							{isProcessing}
							detectionCount={detections.length}
							on:settingsChange={handleMLSettingsChange}
							on:toggleDetection={handleToggleDetection}
						/>
					</div>
				{/if}

				<!-- Mute button -->
				<button
					class="control-button mute-button"
					on:click|stopPropagation={toggleMute}
					aria-label={isMuted ? 'Unmute' : 'Mute'}
				>
					{#if isMuted}
						<Icon name="VolumeX" size={20} />
					{:else}
						<Icon name="Volume2" size={20} />
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
		overflow: visible; /* Changed to allow overlay positioning */
		background: #000;
	}

	.video-element {
		width: 100%;
		height: auto;
		display: block;
		cursor: pointer;
		border-radius: 8px;
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
	.performance-monitor-container {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 20;
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
		border-radius: 8px;
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
		display: flex;
		align-items: flex-end;
		gap: 12px;
		z-index: 2000;
		width: 100%;
	}

	.ml-controls-container {
		display: flex;
		width: 100%;
		pointer-events: auto;
	}

	.mute-button {
		width: 40px;
		height: 40px;
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.play-button {
			width: 50px;
			height: 50px;
		}

		.mute-button {
			width: 35px;
			height: 35px;
		}

		.bottom-controls {
			bottom: 8px;
			right: 8px;
			gap: 8px;
		}
	}
</style>
