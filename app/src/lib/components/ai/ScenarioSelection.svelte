<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Scenario } from '$lib/types/types';
	import { networkStore } from '$lib/stores/networkStore';

	export let scenarios: Scenario[];

	const dispatch = createEventDispatcher<{
		select: Scenario;
	}>();

	function handleSelect(scenario: Scenario) {
		networkStore.addScenario(scenario);
		dispatch('select', scenario);
	}
</script>

<div class="scenario-selection">
	<h2>Select a Scenario</h2>
	<div class="scenarios">
		{#each scenarios as scenario (scenario.id)}
			<button class="scenario-button" on:click={() => handleSelect(scenario)}>
				{scenario.description}
			</button>
		{/each}
	</div>
</div>

<style>
	.scenario-selection {
		margin-bottom: 20px;
	}

	h2 {
		font-size: 1.5em;
		margin-bottom: 10px;
	}

	.scenarios {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.scenario-button {
		padding: 10px;
		background-color: #f0f0f0;
		border: 1px solid #ccc;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.3s;
		background-color: red;
	}

	.scenario-button:hover {
		background-color: #e0e0e0;
	}
</style>
