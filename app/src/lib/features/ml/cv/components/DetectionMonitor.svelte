<!-- src/lib/features/ml/cv/components/DetectionMonitor.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	export let isVisible: boolean = false;
	export let isProcessing: boolean = false;
	export let detectionCount: number = 0;

	// Performance metrics
	let fps = 0;
	let averageProcessingTime = 0;
	let totalDetections = 0;
	let lastFrameTime = 0;
	let processingTimes: number[] = [];
	let fpsHistory: number[] = [];
	let maxHistoryLength = 30;

	let processingStartTime = 0;

	// Update FPS calculation
	function updateFPS() {
		const now = performance.now();
		if (lastFrameTime > 0) {
			const deltaTime = now - lastFrameTime;
			const currentFPS = 1000 / deltaTime;

			fpsHistory.push(currentFPS);
			if (fpsHistory.length > maxHistoryLength) {
				fpsHistory.shift();
			}

			fps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
		}
		lastFrameTime = now;
	}

	// Track processing start
	export function startProcessing() {
		processingStartTime = performance.now();
	}

	// Track processing end
	export function endProcessing() {
		if (processingStartTime > 0) {
			const processingTime = performance.now() - processingStartTime;
			processingTimes.push(processingTime);

			if (processingTimes.length > maxHistoryLength) {
				processingTimes.shift();
			}

			averageProcessingTime = Math.round(
				processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
			);

			processingStartTime = 0;
			updateFPS();
		}
	}

	// Update total detections when detection count changes
	$: if (detectionCount >= 0) {
		totalDetections += detectionCount;
	}

	// Performance status indicator
	$: performanceStatus = getPerformanceStatus(fps, averageProcessingTime);

	function getPerformanceStatus(fps: number, processingTime: number) {
		if (fps >= 8 && processingTime <= 200) return 'excellent';
		if (fps >= 5 && processingTime <= 400) return 'good';
		if (fps >= 2 && processingTime <= 800) return 'fair';
		return 'poor';
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'excellent':
				return '#22c55e';
			case 'good':
				return '#84cc16';
			case 'fair':
				return '#f59e0b';
			case 'poor':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}

	function reset() {
		fps = 0;
		averageProcessingTime = 0;
		totalDetections = 0;
		processingTimes = [];
		fpsHistory = [];
		lastFrameTime = 0;
	}

	onDestroy(() => {
		reset();
	});
</script>

{#if isVisible}
	<div class="performance-monitor">
		<div class="monitor-header">
			<Icon name="Activity" size={14} />
			<span>Performance</span>
			<!-- Performance Status -->
			<div class="status-bar">
				<div
					class="status-indicator"
					style="background-color: {getStatusColor(performanceStatus)}"
				></div>
				<span class="status-text" style="color: {getStatusColor(performanceStatus)}">
					{performanceStatus.toUpperCase()}
				</span>
				{#if isProcessing}
					<div class="processing-pulse"></div>
				{/if}
			</div>
			<button class="reset-btn" on:click={reset} title="Reset metrics">
				<Icon name="Loader2" size={12} />
			</button>
		</div>

		<div class="metrics-grid">
			<!-- FPS -->
			<div class="metric">
				<div class="metric-label">FPS</div>
				<div class="metric-value">
					{fps}
					<span class="metric-unit">fps</span>
				</div>
			</div>

			<!-- Processing Time -->
			<div class="metric">
				<div class="metric-label">Processing</div>
				<div class="metric-value">
					{averageProcessingTime}
					<span class="metric-unit">ms</span>
				</div>
			</div>

			<!-- Current Detections -->
			<div class="metric">
				<div class="metric-label">Objects</div>
				<div class="metric-value">
					{detectionCount}
					<span class="metric-unit">now</span>
				</div>
			</div>

			<!-- Total Detections -->
			<div class="metric">
				<div class="metric-label">Total</div>
				<div class="metric-value">
					{totalDetections}
					<span class="metric-unit">all</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.performance-monitor {
		background: rgba(0, 0, 0, 0.85);
		border-radius: 6px;
		padding: 8px;
		color: var(--text-color);
		font-size: 11px;
		min-width: 140px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.monitor-header {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 6px;
		font-weight: 500;
	}

	.reset-btn {
		margin-left: auto;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		transition: all 0.2s ease;
	}

	.reset-btn:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.metrics-grid {
		display: flex;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-bottom: 6px;
	}

	.metric {
		text-align: center;
	}

	.metric-label {
		color: rgba(255, 255, 255, 0.7);
		font-size: 9px;
		margin-bottom: 1px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.metric-value {
		font-weight: 600;
		font-size: 12px;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 2px;
	}

	.metric-unit {
		font-size: 8px;
		color: rgba(255, 255, 255, 0.5);
		font-weight: normal;
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.status-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.status-text {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.processing-pulse {
		width: 4px;
		height: 4px;
		background: #22c55e;
		border-radius: 50%;
		margin-left: auto;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.performance-monitor {
			font-size: 10px;
			padding: 6px;
		}

		.metrics-grid {
			gap: 4px;
		}
	}
</style>
