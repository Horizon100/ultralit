<script lang="ts">
	import type { Shape } from '$lib/types/types';

	export let selectedShape: Shape;

	let name = '';
	let status = 'active';
	let focus = 'processor';

	function updateAgent() {
		// Implement the logic to update the agent
		console.log('Updating agent:', { name, status, focus });
	}
</script>

<div class="agent-content">
	<label>
		Name:
		<input type="text" bind:value={name} />
	</label>

	<label>
		Status:
		<select bind:value={status}>
			<option value="active">Active</option>
			<option value="inactive">Inactive</option>
			<option value="maintenance">Maintenance</option>
		</select>
	</label>

	<label>
		Focus:
		<select bind:value={focus}>
			<option value="processor">Processor</option>
			<option value="communicator">Communicator</option>
		</select>
	</label>

	<button on:click={updateAgent}>Update Agent</button>
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.agent-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
	}

	input,
	select {
		margin-top: 0.5rem;
	}

	button {
		margin-top: 1rem;
		padding: 0.5rem;
		background-color: #4caf50;
		color: white;
		border: none;
		cursor: pointer;
	}
</style>
