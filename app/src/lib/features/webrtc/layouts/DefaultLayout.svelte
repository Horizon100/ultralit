<!-- src/lib/layouts/DefaultLayout.svelte -->
<script>
	export let title;
	export let description;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
</svelte:head>

<div class="default-layout">
	<article class="prose prose-invert max-w-4xl mx-auto p-8">
		<slot />
	</article>
</div>

<style>
	.default-layout {
		background: #0f0f0f;
		min-height: 100vh;
	}
</style>