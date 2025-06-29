<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	export let code: string;

	function formatJSON(jsonString: string): string {
		const tokenTypes = {
			punctuation: /[{}[\],]/g,
			key: /"([^"]+)"(?=\s*:)/g,
			string: /"([^"]+)"/g,
			number: /-?\d+\.?\d*/g,
			boolean: /\b(true|false)\b/g,
			null: /\bnull\b/g
		};

		let highlightedCode = jsonString
			// First escape HTML special characters
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Format and highlight keys
		highlightedCode = highlightedCode.replace(tokenTypes.key, '<span class="json-key">$&</span>');

		// Highlight string values (but not keys)
		highlightedCode = highlightedCode.replace(tokenTypes.string, (match) => {
			if (!match.match(/"([^"]+)"(?=\s*:)/)) {
				return '<span class="json-string">' + match + '</span>';
			}
			return match;
		});

		// Highlight numbers
		highlightedCode = highlightedCode.replace(
			tokenTypes.number,
			'<span class="json-number">$&</span>'
		);

		// Highlight booleans
		highlightedCode = highlightedCode.replace(
			tokenTypes.boolean,
			'<span class="json-boolean">$&</span>'
		);

		// Highlight null
		highlightedCode = highlightedCode.replace(tokenTypes.null, '<span class="json-null">$&</span>');

		// Highlight punctuation
		highlightedCode = highlightedCode.replace(
			tokenTypes.punctuation,
			'<span class="json-punctuation">$&</span>'
		);

		// Add line breaks and indentation
		let formatted = '';
		let indentLevel = 0;
		const lines = highlightedCode.split('\n');

		for (let line of lines) {
			line = line.trim();
			if (line.includes('}') || line.includes(']')) {
				indentLevel--;
			}

			formatted += '  '.repeat(Math.max(0, indentLevel)) + line + '\n';

			if (line.includes('{') || line.includes('[')) {
				indentLevel++;
			}
		}

		return formatted;
	}

	$: formattedCode = formatJSON(code);
</script>

<pre class="json-container">
	
  <code class="json-code">
	<!-- Safe: Formatted JSON code -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html formattedCode}
</code>
</pre>

<style lang="postcss">
	.json-container {
		background: #1e1e1e;
		border-radius: 6px;
		padding: 1rem;
		margin: 0;
		overflow-x: auto;
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 14px;
		line-height: 1.5;
	}

	.json-code {
		display: block;
		white-space: pre;
		color: #d4d4d4;
	}

	:global(.json-key) {
		color: #9cdcfe;
	}

	:global(.json-string) {
		color: #ce9178;
	}

	:global(.json-number) {
		color: #b5cea8;
	}

	:global(.json-boolean) {
		color: #569cd6;
	}

	:global(.json-null) {
		color: #569cd6;
	}

	:global(.json-punctuation) {
		color: #d4d4d4;
	}

	/* Scrollbar styling */
	.json-container::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.json-container::-webkit-scrollbar-thumb {
		background: #4a4a4a;
		border-radius: 4px;
	}

	.json-container::-webkit-scrollbar-track {
		background: #2a2a2a;
		border-radius: 4px;
	}
</style>
