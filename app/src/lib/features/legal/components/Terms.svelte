<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

<div class="auth-overlay" on:click|self={close}>
	<div class="auth-content">
		<h2>Terms of Service</h2>
		<p>
			These are the Terms of Service for vRazum. By using our service, you agree to these terms.
			<!-- Add more content here -->
		</p>
		<button class="auth" on:click={close}>Close</button>
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
</style>
