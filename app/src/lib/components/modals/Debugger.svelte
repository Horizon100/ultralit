<script lang="ts">
	import { browser } from '$app/environment';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

	// Props
	export let showDebug: boolean = true;
	export let title: string = '🔧 Debug Panel';
	export let debugItems: Array<{ label: string; value: any }> = [];
	export let buttons: Array<{
		label: string;
		action: () => void | Promise<void>;
		color?: string;
	}> = [];
	export let position: string = 'top: 10px; right: 10px;';
	export let minWidth: string = '250px';
	export let maxWidth: string = '300px';
	export let fontSize: string = '12px';

	function formatValue(value: any): string {
		if (typeof value === 'boolean') {
			return value ? '✅' : '❌';
		}
		if (value === null || value === undefined) {
			return '❌';
		}
		if (typeof value === 'string') {
			// Handle special cases
			if (value === 'YES' || value === 'NO') return value;
			if (value.includes('⏳') || value.includes('💤')) return value;
			return value;
		}
		return String(value);
	}

	async function handleButtonClick(button: typeof buttons[0]) {
		const result = await clientTryCatch(
			typeof button.action === 'function' ? button.action() : Promise.resolve(button.action),
			`Debug button action: ${button.label}`
		);

		if (isFailure(result)) {
			console.error(`Debug button "${button.label}" failed:`, result.error);
		}
	}
</script>

{#if showDebug}
	{#if browser}
		<div 
			class="debugger-panel"
			style="position: fixed; {position} background: rgba(51, 51, 51, 0.95); color: white; padding: 15px; font-size: {fontSize}; z-index: 9999; border-radius: 8px; min-width: {minWidth}; max-width: {maxWidth};"
		>
			<div style="font-weight: bold; margin-bottom: 8px;">{title}</div>
			
			{#each debugItems as item}
				<div class="debugger-row" style="margin-bottom: 2px;">
					<strong>{item.label}:</strong> {formatValue(item.value)}
				</div>
			{/each}
			
			{#if buttons.length > 0}
				<div style="margin-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.2); padding-top: 8px;">
					{#each buttons as button}
						<button 
							class="debugger-button"
							style="background: {button.color || '#007bff'}; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 5px; margin-bottom: 5px;"
							on:click={() => handleButtonClick(button)}
						>
							{button.label}
						</button>
					{/each}
				</div>
			{/if}
			
			<!-- Slot for custom content -->
			<slot />
		</div>
	{/if}
{/if}

<style>
	.debugger-panel {
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.debugger-row:hover {
		background-color: rgba(255, 255, 255, 0.05);
		border-radius: 2px;
		padding: 1px 4px;
		margin: 1px -4px;
	}

	.debugger-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.debugger-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.debugger-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>