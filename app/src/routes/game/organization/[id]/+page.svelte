<!-- src/routes/game/organization/[id]/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { GameOrganization, GameBuilding } from '$lib/types/types.game';
	import { gameStore, gameService } from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import GameNavigator from '$lib/features/game/components/GameNavigator.svelte';

	export let data;

	let organization: GameOrganization | null = null;
	let buildings: GameBuilding[] = [];
	let loading = true;
	let error = '';

	async function loadOrganization() {
		try {
			loading = true;
			const orgId = $page.params.id;

			// Fetch organization details
			const orgResponse = await fetch(`/api/game/organizations/${orgId}`);
			if (!orgResponse.ok) {
				throw new Error('Failed to load organization');
			}
			const orgData = await orgResponse.json();
			organization = orgData.data;

			// Fetch buildings for this organization
			const buildingsResponse = await fetch(`/api/game/buildings?organization=${orgId}`);
			if (!buildingsResponse.ok) {
				throw new Error('Failed to load buildings');
			}
			const buildingsData = await buildingsResponse.json();
			buildings = buildingsData.data;

			// Update game state
			gameStore.update((state: any) => ({
				...state,
				currentView: 'building'
			}));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Organization load error:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadOrganization();
	});
</script>

<div class="world-navigator-section">
	<GameNavigator {data} />
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.organization-view {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: absolute;
		height: 50vh;
		gap: 1rem;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--border-primary);
		border-top: 2px solid var(--primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.organization-header {
		margin-bottom: 3rem;
		text-align: center;
	}

	.organization-header h1 {
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		font-size: 2.5rem;
	}

	.description {
		color: var(--text-secondary);
		font-size: 1.125rem;
		margin-bottom: 1rem;
	}

	.organization-stats {
		display: flex;
		justify-content: center;
		gap: 2rem;
		font-size: 1rem;
	}

	.stat {
		color: var(--text-secondary);
	}

	.stat strong {
		color: var(--primary);
	}

	.buildings-grid h2 {
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.building-card {
		background: var(--background-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 0.75rem;
		padding: 1.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.building-card:hover {
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.building-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.building-header h3 {
		color: var(--text-primary);
		margin: 0;
		font-size: 1.25rem;
	}

	.building-position {
		background: var(--background-tertiary);
		color: var(--text-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		font-family: monospace;
	}

	.building-description {
		color: var(--text-secondary);
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.building-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
	}

	.building-size {
		color: var(--text-tertiary);
		font-size: 0.875rem;
		font-family: monospace;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.error-state button {
		background: var(--primary);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.error-state button:hover {
		background: var(--primary-hover);
	}

	@media (max-width: 768px) {
		.organization-view {
			padding: 1rem;
		}

		.organization-header h1 {
			font-size: 2rem;
		}

		.organization-stats {
			flex-direction: column;
			gap: 0.5rem;
		}

		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
