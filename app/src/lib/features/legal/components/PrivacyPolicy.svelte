<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';

	type PrivacySection = {
		heading: string;
		body: string;
	};
	$: privacyContent = $t('privacy.content') as PrivacySection[];

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
			<h2>{$t('privacy.title')}</h2>
			<p class="description">{$t('privacy.description')}</p>

			{#each privacyContent as section}
				<h3>{section.heading}</h3>
				<p>{section.body}</p>
			{/each}

			<button class="legal" on:click={close}>{$t('status.close')}</button>
		</div>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
</style>
