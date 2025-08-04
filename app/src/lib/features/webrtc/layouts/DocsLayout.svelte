<!-- src/lib/layouts/DocsLayout.svelte -->
<script>
	export let title;
	export let description;
</script>

<svelte:head>
	<title>{title} - Zoom Clone Docs</title>
	<meta name="description" content={description} />
</svelte:head>

<div class="docs-layout">
	<nav class="sidebar">
		<h3>Documentation</h3>
		<ul>
			<li><a href="/docs/getting-started">Getting Started</a></li>
			<li><a href="/docs/api/rooms">Rooms API</a></li>
			<li><a href="/docs/api/auth">Auth API</a></li>
		</ul>
	</nav>
	
	<main class="content">
		<article class="prose prose-invert max-w-none">
			<slot />
		</article>
	</main>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 250px 1fr;
		min-height: 100vh;
		background: #0f0f0f;
	}
	
	.sidebar {
		background: #1a1a1a;
		padding: 2rem 1rem;
		border-right: 1px solid #333;
	}
	
	.sidebar h3 {
		color: var(--text-color);
		margin-bottom: 1rem;
	}
	
	.sidebar ul {
		list-style: none;
		padding: 0;
	}
	
	.sidebar li {
		margin-bottom: 0.5rem;
	}
	
	.sidebar a {
		color: #94a3b8;
		text-decoration: none;
		transition: color 0.2s;
	}
	
	.sidebar a:hover {
		color: var(--text-color);
	}
	
	.content {
		padding: 2rem;
		overflow-x: auto;
	}
</style>

