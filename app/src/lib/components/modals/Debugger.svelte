<script lang="ts">
	import { browser } from '$app/environment';

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
		try {
			await button.action();
		} catch (error) {
			console.error('Debugger button action failed:', error);
		}
	}
</script>

{#if showDebug}
	{#if browser}
		<div style="position: fixed; {position} background: #333; color: white; padding: 15px; font-size: {fontSize}; z-index: 9999; border-radius: 8px; min-width: {minWidth}; max-width: {maxWidth};">
			<div style="font-weight: bold; margin-bottom: 8px;">{title}</div>
			
			{#each debugItems as item}
				<div>{item.label}: {formatValue(item.value)}</div>
			{/each}
			
			{#each buttons as button, index}
				<div style="margin-top: {index === 0 ? '10px' : '5px'};">
					<button 
						style="background: {button.color || '#007bff'}; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
						on:click={() => handleButtonClick(button)}
					>
						{button.label}
					</button>
				</div>
			{/each}
			
			<!-- Slot for custom content -->
			<slot />
		</div>
	{/if}
{/if}
<style>
	.debugger-panel {
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
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
</style>