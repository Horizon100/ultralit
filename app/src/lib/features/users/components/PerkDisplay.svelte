<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Perk } from '$lib/types/types';
	import { t } from '$lib/stores/translationStore';

	export let perks: Perk[] = [];

	let showPerksPanel = false;

	function togglePerksPanel() {
		showPerksPanel = !showPerksPanel;
	}
</script>

// src/lib/components/PerksDisplay.svelte
<div class="perks-container">
	<div class="perks-summary">
		<button class="perks-button" on:click={togglePerksPanel}>
			{perks.length}
			{$t('dashboard.perks') || 'Perks'}
			{showPerksPanel ? '▲' : '▼'}
		</button>
	</div>

	{#if showPerksPanel}
		<div class="perks-panel" transition:fade={{ duration: 200 }}>
			{#if perks.length === 0}
				<div class="no-perks">No perks unlocked yet. Keep using the platform!</div>
			{:else}
				<div class="perks-grid">
					{#each perks as perk}
						<div class="perk-item">
							<div class="perk-icon">{perk.perkIcon}</div>
							<div class="perk-info">
								<div class="perk-name">{perk.perkName}</div>
								<div class="perk-description">{perk.perkDescription}</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.perks-container {
		width: 100%;
		margin-top: 10px;
	}

	.perks-summary {
		display: flex;
		justify-content: center;
		gap: 10px;
	}

	.perks-button {
		background: rgba(1, 149, 137, 0.3);
		color: #ffffff;
		border: none;
		border-radius: 20px;
		padding: 8px 16px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.perks-button:hover {
		background: rgba(1, 149, 137, 0.5);
	}

	.perks-panel {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		padding: 15px;
		margin-top: 10px;
	}

	.no-perks {
		color: #aaaaaa;
		text-align: center;
		padding: 10px;
	}

	.perks-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 15px;
	}

	.perk-item {
		display: flex;
		align-items: center;
		background: rgba(1, 149, 137, 0.1);
		border-radius: 8px;
		padding: 10px;
		transition:
			transform 0.2s ease,
			background 0.2s ease;

		&:hover {
			transform: translateY(-3px);
			background: rgba(1, 149, 137, 0.2);
		}
	}

	.perk-icon {
		font-size: 1.8rem;
		margin-right: 15px;
		min-width: 40px;
		text-align: center;
	}

	.perk-info {
		flex: 1;
	}

	.perk-name {
		font-weight: bold;
		margin-bottom: 5px;
		color: #ffffff;
	}

	.perk-description {
		font-size: 0.85rem;
		color: #cccccc;
	}
</style>
