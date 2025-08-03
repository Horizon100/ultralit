<!-- src/lib/layouts/BlogLayout.svelte -->
<script>
	export let title;
	export let description;
	export let date;
	export let author = 'Team';
</script>

<svelte:head>
	<title>{title} - Blog</title>
	<meta name="description" content={description} />
</svelte:head>

<div class="blog-layout">
	<header class="blog-header">
		<h1>{title}</h1>
		<div class="meta">
			<span>By {author}</span>
			<span>•</span>
			<time>{new Date(date).toLocaleDateString()}</time>
		</div>
	</header>
	
	<article class="prose prose-invert max-w-none">
		<slot />
	</article>
</div>

<style>
	.blog-layout {
		max-width: 4xl;
		margin: 0 auto;
		padding: 2rem;
		background: #0f0f0f;
		min-height: 100vh;
	}
	
	.blog-header {
		margin-bottom: 3rem;
		text-align: center;
	}
	
	.blog-header h1 {
		color: white;
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}
	
	.meta {
		color: #94a3b8;
		font-size: 0.875rem;
	}
	
	.meta span {
		margin: 0 0.5rem;
	}
</style>

