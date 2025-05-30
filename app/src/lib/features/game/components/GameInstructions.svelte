<!-- src/routes/game/GameInstructions.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	let showInstructions = false;
	let hasSeenInstructions = false;

	onMount(() => {
		// Check if user has seen instructions before
		hasSeenInstructions = localStorage.getItem('gameInstructionsSeen') === 'true';

		// Show instructions for first-time users
		if (!hasSeenInstructions) {
			showInstructions = true;
		}
	});

	function closeInstructions() {
		showInstructions = false;
		localStorage.setItem('gameInstructionsSeen', 'true');
	}

	function toggleInstructions() {
		showInstructions = !showInstructions;
	}

	// Export function to allow parent components to show instructions
	export { toggleInstructions };
</script>

<!-- Instructions trigger button -->
<button
	class="instructions-trigger fixed bottom-4 left-4 w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-blue-600 transition-colors"
	on:click={toggleInstructions}
	title="Game Instructions"
>
	<span class="text-xl">?</span>
</button>

<!-- Instructions modal -->
{#if showInstructions}
	<div
		class="instructions-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
	>
		<div class="modal-content bg-white rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto">
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-2xl font-bold text-gray-800">Game Instructions</h2>
				<button class="text-gray-500 hover:text-gray-700 text-2xl" on:click={closeInstructions}>
					×
				</button>
			</div>

			<div class="instructions-content space-y-4 text-gray-700">
				<section>
					<h3 class="text-lg font-semibold text-blue-600 mb-2">Getting Started</h3>
					<ul class="list-disc list-inside space-y-1">
						<li>
							Welcome to the collaborative LLM workspace! This interface uses a Pokemon-inspired map
							layout.
						</li>
						<li>
							You start on the main map with different buildings representing different work areas.
						</li>
						<li>Your character (avatar) can move around by clicking on the map.</li>
					</ul>
				</section>

				<section>
					<h3 class="text-lg font-semibold text-blue-600 mb-2">Buildings & Areas</h3>
					<div class="grid grid-cols-2 gap-4">
						<div class="border rounded-lg p-3">
							<h4 class="font-semibold flex items-center gap-2">🏢 Office Building</h4>
							<p class="text-sm">Contains HR room and Data Library</p>
						</div>
						<div class="border rounded-lg p-3">
							<h4 class="font-semibold flex items-center gap-2">🏭 Factory Building</h4>
							<p class="text-sm">Manufacturing, Assembly, and QA rooms</p>
						</div>
						<div class="border rounded-lg p-3">
							<h4 class="font-semibold flex items-center gap-2">📦 Logistics Hub</h4>
							<p class="text-sm">Import/Export data management</p>
						</div>
						<div class="border rounded-lg p-3">
							<h4 class="font-semibold flex items-center gap-2">🆘 Support Center</h4>
							<p class="text-sm">Get help and assistance</p>
						</div>
					</div>
				</section>

				<section>
					<h3 class="text-lg font-semibold text-blue-600 mb-2">Navigation</h3>
					<ul class="list-disc list-inside space-y-1">
						<li><strong>Click a building</strong> to enter it and see available rooms</li>
						<li><strong>Click a room</strong> to enter and see tables/workspaces</li>
						<li><strong>Click a table</strong> to join a collaborative session</li>
						<li><strong>Roads connect buildings</strong> and show message flow between areas</li>
					</ul>
				</section>

				<section>
					<h3 class="text-lg font-semibold text-blue-600 mb-2">Keyboard Shortcuts</h3>
					<div class="grid grid-cols-1 gap-2">
						<div class="flex justify-between items-center">
							<span class="font-mono bg-gray-100 px-2 py-1 rounded">M</span>
							<span>Return to Map view</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="font-mono bg-gray-100 px-2 py-1 rounded">Esc</span>
							<span>Leave current location</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="font-mono bg-gray-100 px-2 py-1 rounded">?</span>
							<span>Show/hide instructions</span>
						</div>
					</div>
				</section>

				<section>
					<h3 class="text-lg font-semibold text-blue-600 mb-2">Collaboration</h3>
					<ul class="list-disc list-inside space-y-1">
						<li>See other users' avatars moving around in real-time</li>
						<li>Join tables to start collaborative LLM sessions</li>
						<li>Different rooms are optimized for different types of work</li>
						<li>Message flows between buildings show activity and connections</li>
					</ul>
				</section>
			</div>

			<div class="mt-6 text-center">
				<button
					class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
					on:click={closeInstructions}
				>
					Got it!
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.instructions-modal {
		backdrop-filter: blur(5px);
	}

	.modal-content {
		animation: modalFadeIn 0.3s ease-out;
	}

	@keyframes modalFadeIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
