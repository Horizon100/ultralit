<script lang="ts">
	import { onMount } from 'svelte';
	import type { Detection } from '$lib/types/types.ml';
	import { scaleBoundingBox, getDetectionColor } from '../utils/detectionUtils';

	export let detections: Detection[] = [];
	export let videoElement: HTMLVideoElement;
	export let showLabels: boolean = true;
	export let showConfidence: boolean = true;
	export let className: string = '';

	let overlayElement: HTMLDivElement;
	let videoRect: DOMRect;

	// Update overlay position when video size changes
	function updateOverlayPosition() {
		if (!videoElement || !overlayElement) return;

		videoRect = videoElement.getBoundingClientRect();
		const containerRect = videoElement.parentElement?.getBoundingClientRect();

		if (containerRect) {
			overlayElement.style.left = `${videoRect.left - containerRect.left}px`;
			overlayElement.style.top = `${videoRect.top - containerRect.top}px`;
			overlayElement.style.width = `${videoRect.width}px`;
			overlayElement.style.height = `${videoRect.height}px`;
		}
	}

	// Scale detection coordinates to overlay size
	$: scaledDetections = detections.map((detection) => ({
		...detection,
		bbox: videoElement ? scaleBoundingBox(detection.bbox, videoElement) : detection.bbox
	}));

	onMount(() => {
		if (videoElement) {
			updateOverlayPosition();

			// Update position on window resize
			const handleResize = () => updateOverlayPosition();
			window.addEventListener('resize', handleResize);

			// Update position when video loads
			videoElement.addEventListener('loadedmetadata', updateOverlayPosition);

			return () => {
				window.removeEventListener('resize', handleResize);
				videoElement?.removeEventListener('loadedmetadata', updateOverlayPosition);
			};
		}
	});

	// Update position when detections change
	$: if (detections.length > 0) {
		setTimeout(updateOverlayPosition, 10);
	}
</script>

<div class="detection-overlay {className}" bind:this={overlayElement} style="pointer-events: none;">
	{#each scaledDetections as detection}
		{@const color = getDetectionColor(detection.class_id)}
		{@const { bbox } = detection}

		<!-- Detection bounding box -->
		<div
			class="detection-box"
			style="
				left: {bbox.x1}px;
				top: {bbox.y1}px;
				width: {bbox.x2 - bbox.x1}px;
				height: {bbox.y2 - bbox.y1}px;
				border-color: {color};
				box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
			"
		>
			<!-- Detection label -->
			{#if showLabels}
				<div class="detection-label" style="background-color: {color};">
					<span class="label-text">
						{detection.class_name}
						{#if showConfidence}
							<span class="confidence">
								{Math.round(detection.confidence * 100)}%
							</span>
						{/if}
					</span>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.detection-overlay {
		position: absolute;
		pointer-events: none;
		z-index: 10;
	}

	.detection-box {
		position: absolute;
		border: 2px solid;
		border-radius: 4px;
		transition: all 0.1s ease;
	}

	.detection-label {
		position: absolute;
		top: -24px;
		left: 0;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 600;
		color: white;
		white-space: nowrap;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.label-text {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.confidence {
		font-size: 10px;
		opacity: 0.9;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.detection-label {
			font-size: 10px;
			padding: 1px 4px;
		}

		.confidence {
			font-size: 9px;
		}
	}
</style>
