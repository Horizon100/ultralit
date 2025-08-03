<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	type TermsSection = {
		heading: string;
		body: string;
	};
	$: termsContent = $t('terms.content') as TermsSection[];
	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

<div
	class="legal-overlay"
	role="button"
	tabindex="0"
	on:click|self={close}
	on:keydown|self={(e) => {
		if (e.key === 'Enter' || e.key === ' ') close();
	}}
>
	<div class="legal-content">
		<div class="legal-wrapper">
			<h2>{$t('terms.title')}</h2>
			<p class="description">{$t('terms.description')}</p>

			{#each termsContent as section}
				<h3>{section.heading}</h3>
				<p>{section.body}</p>
			{/each}

			<button class="legal" on:click={close}>{$t('status.close')}</button>
		</div>
	</div>
</div>

<style lang="scss">
	* {
		font-family: var(--font-family);
	}
</style>
