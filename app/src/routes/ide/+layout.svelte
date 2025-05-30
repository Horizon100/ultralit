<script>
	// IDE Layout
</script>

<slot />

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	/* Reset CSS */
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	/* Fonts for the editor */
	@font-face {
		font-family: 'JetBrains Mono';
		src: url('https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono-Regular.woff2')
			format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
			'Helvetica Neue', sans-serif;
	}
</style>
