<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DetectionSettings, AvailableModels } from '$lib/types/types.ml';
	import { cvApi } from '../utils/cvApi';
	import { fly } from 'svelte/transition';

	const dispatch = createEventDispatcher<{
		settingsChange: DetectionSettings;
		toggleDetection: boolean;
	}>();

	export let settings: DetectionSettings = {
		enabled: false,
		confidence: 0.5,
		model: 'yolov8n',
		frameSkip: 3,
		showLabels: true,
		showConfidence: true
	};

	export let isProcessing: boolean = false;
	export let detectionCount: number = 0;

	let availableModels: AvailableModels = {};
	let isLoadingModels = false;
	let showAdvanced = false;
	let serviceHealth: 'unknown' | 'healthy' | 'unhealthy' = 'unknown';

	// Load available models on mount
	onMount(async () => {
		await loadModels();
		await checkServiceHealth();
	});

	async function loadModels() {
		try {
			isLoadingModels = true;
			availableModels = await cvApi.getAvailableModels();
		} catch (error) {
			console.error('Failed to load models:', error);
		} finally {
			isLoadingModels = false;
		}
	}

	async function checkServiceHealth() {
		try {
			const health = await cvApi.checkHealth();
			serviceHealth = health.status;
		} catch (error) {
			serviceHealth = 'unhealthy';
		}
	}

	function toggleDetection() {
		settings.enabled = !settings.enabled;
		dispatch('toggleDetection', settings.enabled);
		dispatch('settingsChange', settings);
	}

	function updateSettings() {
		dispatch('settingsChange', settings);
	}

	async function changeModel(modelName: string) {
		try {
			await cvApi.switchModel(modelName);
			settings.model = modelName;
			updateSettings();
		} catch (error) {
			console.error('Failed to switch model:', error);
		}
	}
</script>

<div
	class="detection-controls"
	in:fly={{ y: 200, duration: 300 }}
	out:fly={{ y: 200, duration: 300 }}
>
	<!-- Main toggle button -->
	<div class="main-controls" in:fly={{ y: 200, duration: 300 }} out:fly={{ y: 200, duration: 300 }}>
		<button
			class="toggle-button {settings.enabled ? 'active' : ''}"
			on:click={toggleDetection}
			disabled={serviceHealth === 'unhealthy'}
			title={serviceHealth === 'unhealthy' ? 'ML service unavailable' : ''}
		>
			<Icon name={settings.enabled ? 'Eye' : 'EyeOff'} size={16} />
			<span>AI Detection</span>
			{#if isProcessing}
				<div class="processing-indicator"></div>
			{/if}
		</button>

		{#if settings.enabled && detectionCount > 0}
			<span class="detection-count">
				{detectionCount} object{detectionCount !== 1 ? 's' : ''}
			</span>
		{/if}

		<!-- Service status indicator -->
		<div class="status-indicator {serviceHealth}"></div>
	</div>

	{#if settings.enabled}
		<!-- Quick controls -->
		<div class="quick-controls">
			<div class="control-group">
				<label for="confidence">Confidence</label>
				<input
					id="confidence"
					type="range"
					min="0.1"
					max="0.9"
					step="0.1"
					bind:value={settings.confidence}
					on:input={updateSettings}
				/>
				<span class="value">{Math.round(settings.confidence * 100)}%</span>
			</div>

			<button class="advanced-toggle" on:click={() => (showAdvanced = !showAdvanced)}>
				<Icon name={showAdvanced ? 'ChevronUp' : 'ChevronDown'} size={16} />
				Advanced
			</button>
		</div>

		{#if showAdvanced}
			<!-- Advanced controls -->
			<div class="advanced-controls">
				<!-- Model selection -->
				<div class="control-group">
					<label for="model">Model</label>
					<select
						id="model"
						bind:value={settings.model}
						on:change={() => changeModel(settings.model)}
						disabled={isLoadingModels}
					>
						{#if isLoadingModels}
							<option>Loading...</option>
						{:else}
							{#each Object.entries(availableModels) as [key, model]}
								<option value={key}>
									{key} ({model.size}) - {model.description}
								</option>
							{/each}
						{/if}
					</select>
				</div>

				<!-- Frame skip -->
				<div class="control-group">
					<label for="frameSkip">Process every</label>
					<select id="frameSkip" bind:value={settings.frameSkip} on:change={updateSettings}>
						<option value={1}>1 frame (slowest)</option>
						<option value={2}>2 frames</option>
						<option value={3}>3 frames (recommended)</option>
						<option value={5}>5 frames</option>
						<option value={10}>10 frames (fastest)</option>
					</select>
				</div>

				<!-- Display options -->
				<div class="display-options">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={settings.showLabels} on:change={updateSettings} />
						<span>Show labels</span>
					</label>

					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={settings.showConfidence}
							on:change={updateSettings}
						/>
						<span>Show confidence</span>
					</label>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.detection-controls {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		background: rgba(0, 0, 0, 0.8);
		border-radius: 0.5rem;
		padding: 0.5rem;
		color: var(--text-color);
		font-size: 0.8rem;
		backdrop-filter: blur(20px);
		width: 100%;
		flex: 1;
		transition: all 0.3s ease;
	}

	.main-controls {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 8px;
	}

	.toggle-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		color: var(--text-color);
		padding: 6px 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
	}

	.toggle-button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
	}

	.toggle-button.active {
		background: rgba(34, 197, 94, 0.3);
		border-color: rgba(34, 197, 94, 0.5);
	}

	.toggle-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.processing-indicator {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 6px;
		height: 6px;
		background: #22c55e;
		border-radius: 50%;
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

	.detection-count {
		font-size: 12px;
		color: #22c55e;
		font-weight: 500;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-left: auto;
	}

	.status-indicator.healthy {
		background: #22c55e;
	}

	.status-indicator.unhealthy {
		background: #ef4444;
	}

	.status-indicator.unknown {
		background: #f59e0b;
	}

	.quick-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.advanced-controls {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.control-group label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);

		min-width: 70px;
	}
	.control-group input {
		background: var(--bg-color);
	}
	.control-group input[type='range'] {
		flex: 1;
		min-width: 80px;
	}

	.control-group select {
		flex: 1;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid var(--line-color);
		border-radius: 4px;
		color: var(--text-color);
		padding: 4px 6px;
		font-size: 12px;
		width: 200px;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
	}

	.value {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.7);
		min-width: 30px;
		text-align: right;
	}

	.advanced-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		font-size: 12px;
		padding: 4px 0;
	}

	.advanced-toggle:hover {
		color: var(--text-color);
	}

	.display-options {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 12px;
	}

	.checkbox-label input[type='checkbox'] {
		margin: 0;
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.detection-controls {
			font-size: 12px;
			padding: 8px;
		}

		.toggle-button {
			padding: 4px 8px;
		}
	}
</style>
