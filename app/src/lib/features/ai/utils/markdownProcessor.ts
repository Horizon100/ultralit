// markdownProcessor.ts
import { marked } from 'marked';

marked.setOptions({
	gfm: true,
	breaks: true
	// Removed 'mangle' and 'headerIds' as they don't exist in current MarkedOptions
});

/**
 * Safely stringify any value, handling objects, arrays, and primitives
 * @param value Any value to convert to a string
 * @returns A properly formatted string representation
 */
function safeStringify(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (value === null) return 'null';

	// For objects, use JSON.stringify with pretty formatting
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			// If circular reference or other JSON error, try to get a string representation
			try {
				return Object.prototype.toString.call(value);
			} catch {
				return '[Complex Object]';
			}
		}
	}

	// For primitives, convert to string
	return String(value);
}

/**
 * Highlight JSON with syntax colors
 * @param code The JSON string to highlight
 * @returns HTML with syntax highlighting spans
 */
function highlightJSON(code: string): string {
	try {
		const tokenTypes = {
			punctuation: /[{}[\],]/g,
			key: /"([^"]+)"(?=\s*:)/g,
			string: /"([^"]+)"/g,
			number: /-?\d+\.?\d*/g,
			boolean: /\b(true|false)\b/g,
			null: /\bnull\b/g
		};

		let highlightedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		// Highlight keys
		highlightedCode = highlightedCode.replace(tokenTypes.key, '<span class="json-key">$&</span>');

		// Highlight string values
		highlightedCode = highlightedCode.replace(tokenTypes.string, (match) => {
			if (!match.match(/"([^"]+)"(?=\s*:)/)) {
				return '<span class="json-string">' + match + '</span>';
			}
			return match;
		});

		// Highlight other tokens
		highlightedCode = highlightedCode
			.replace(tokenTypes.number, '<span class="json-number">$&</span>')
			.replace(tokenTypes.boolean, '<span class="json-boolean">$&</span>')
			.replace(tokenTypes.null, '<span class="json-null">$&</span>')
			.replace(tokenTypes.punctuation, '<span class="json-punctuation">$&</span>');

		return highlightedCode;
	} catch (error) {
		console.error('Error highlighting JSON:', error);
		return code;
	}
}

/**
 * Highlight code based on language
 * @param code The code to highlight
 * @param language The programming language
 * @returns HTML with syntax highlighting
 */
function highlightCode(code: string, language: string): string {
	// Process specific languages
	if (language === 'json') {
		try {
			// Format JSON if it's valid
			const formattedJSON = JSON.stringify(JSON.parse(code), null, 2);
			return highlightJSON(formattedJSON);
		} catch {
			// If JSON parsing fails, highlight as is
			return highlightJSON(code);
		}
	}

	// Escape HTML characters for all other languages
	return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Custom renderer for code blocks and other elements
const renderer = new marked.Renderer();

// Enhance code rendering
renderer.code = function ({ text, lang = '' }: { text: string; lang?: string }) {
	// Handle object case (happens when code is passed as an object instead of string)
	let code = text;
	if (typeof code === 'object') {
		code = safeStringify(code);
	}

	const highlightedCode = highlightCode(code, lang);
	const langClass = lang ? ` language-${lang}` : '';

	// Add data attributes to help with copy functionality
	return `<pre class="code-block${langClass}" data-raw-code="${encodeURIComponent(code)}"><code class="${langClass}">${highlightedCode}</code></pre>`;
};

// Properly handle inline code
renderer.codespan = function ({ text }: { text: string }) {
	// Handle object case
	let code = text;
	if (typeof code === 'object') {
		code = safeStringify(code);
	}

	const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	return `<code class="inline-code" data-raw-code="${encodeURIComponent(code)}">${escapedCode}</code>`;
};

// Set the custom renderer
marked.setOptions({ renderer });

/**
 * Process markdown content to HTML with enhanced code handling
 * @param content Markdown content to process
 * @returns HTML content
 */
export async function processMarkdown(content: string): Promise<string> {
	try {
		// Normalize line endings
		const normalizedContent = content.replace(/\r\n/g, '\n');

		// Convert markdown to HTML
		const processed = await marked(normalizedContent);

		return (
			processed
				// Ensure proper spacing around headers
				.replace(/(<h[1-6]>)/g, '\n$1')
				.replace(/(<\/h[1-6]>)/g, '$1\n')
				// Proper list formatting
				.replace(/(<[uo]l>)/g, '\n$1')
				.replace(/(<\/[uo]l>)/g, '$1\n')
				// Proper code block formatting
				.replace(/(<pre[^>]*>)/g, '\n$1')
				.replace(/(<\/pre>)/g, '$1\n')
				// Clean up excessive newlines
				.replace(/\n{3,}/g, '\n\n')
		);
	} catch (error) {
		console.error('Error processing markdown:', error);
		return content || '';
	}
}

/**
 * Extract clean text content from HTML, with special handling for code blocks
 * @param html HTML content to extract text from
 * @returns Plain text representation
 */
export function extractPlainTextFromHtml(html: string): string {
	if (!html) return '';

	try {
		// Create a temporary DOM element
		const tempElement = document.createElement('div');
		tempElement.innerHTML = html;

		// Handle code blocks specially - use the original code stored in data attributes
		const codeBlocks = tempElement.querySelectorAll('pre[data-raw-code], code[data-raw-code]');
		codeBlocks.forEach((block) => {
			const rawCode = block.getAttribute('data-raw-code');
			if (rawCode) {
				// Replace the content with the decoded original
				try {
					const decodedCode = decodeURIComponent(rawCode);

					// Create a text node containing the code
					const textNode = document.createTextNode(decodedCode);

					// If it's a pre element, wrap in backticks for code blocks
					if (block.tagName.toLowerCase() === 'pre') {
						// Clear existing content
						block.innerHTML = '';

						// Add a line before and after with triple backticks
						block.appendChild(document.createTextNode('```\n'));
						block.appendChild(textNode);
						block.appendChild(document.createTextNode('\n```'));
					} else {
						// For inline code, replace with backtick-wrapped text
						const parent = block.parentNode;
						if (parent) {
							const inlineCode = document.createTextNode('`' + decodedCode + '`');
							parent.replaceChild(inlineCode, block);
						}
					}
				} catch (e) {
					console.error('Error decoding code block:', e);
				}
			}
		});

		// Format tables for plain text
		const tables = tempElement.querySelectorAll('table');
		tables.forEach((table) => {
			formatTableForPlainText(table as HTMLTableElement);
		});

		return tempElement.textContent || '';
	} catch (error) {
		console.error('Error extracting plain text:', error);
		// Fallback to simple HTML stripping if the DOM approach fails
		return html.replace(/<[^>]*>/g, '');
	}
}

/**
 * Format a table element for plain text representation
 * @param table The HTML table element
 */
function formatTableForPlainText(table: HTMLTableElement): void {
	const rows = table.querySelectorAll('tr');

	rows.forEach((row) => {
		// Add newlines between rows
		if (row.nextElementSibling) {
			row.appendChild(document.createTextNode('\n'));
		}

		// Add spacing between cells
		const cells = row.querySelectorAll('th, td');
		cells.forEach((cell, index) => {
			// Don't add tab after the last cell
			if (index < cells.length - 1) {
				cell.appendChild(document.createTextNode('\t'));
			}
		});
	});

	// Add an extra newline after the table
	table.appendChild(document.createTextNode('\n\n'));
}

/**
 * Svelte action to add copy buttons to code blocks
 * @param node The element to attach the action to
 * @returns Svelte action object
 */
export function enhanceCodeBlocks(node: HTMLElement) {
	function initCopyButtons() {
		const codeBlocks = node.querySelectorAll('pre:not(.copy-enabled)');

		codeBlocks.forEach((pre) => {
			pre.classList.add('copy-enabled');

			// Make sure the pre element has position relative
			if (getComputedStyle(pre).position === 'static') {
				(pre as HTMLElement).style.position = 'relative';
			}

			// Create the copy button
			const copyButton = document.createElement('button');
			copyButton.className = 'copy-code-button';
			copyButton.innerHTML =
				'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
			copyButton.title = 'Copy to clipboard';

			// Style the button
			copyButton.style.position = 'absolute';
			copyButton.style.top = '0.5rem';
			copyButton.style.right = '0.5rem';
			copyButton.style.padding = '0.35rem';
			copyButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
			copyButton.style.border = 'none';
			copyButton.style.borderRadius = '3px';
			copyButton.style.color = 'rgba(255, 255, 255, 0.6)';
			copyButton.style.cursor = 'pointer';
			copyButton.style.opacity = '0';
			copyButton.style.transition = 'opacity 0.2s';

			// Add the button to the pre element
			pre.appendChild(copyButton);

			// Show button on hover
			pre.addEventListener('mouseenter', () => {
				copyButton.style.opacity = '1';
			});

			pre.addEventListener('mouseleave', () => {
				copyButton.style.opacity = '0';
			});

			// Copy code when button is clicked
			copyButton.addEventListener('click', async (event) => {
				event.preventDefault();
				event.stopPropagation();

				try {
					// Get the code element
					const code = pre.querySelector('code');
					if (!code) return;

					// Try to get raw code from data attribute first
					const rawCode = pre.getAttribute('data-raw-code');
					let textToCopy = '';

					if (rawCode) {
						textToCopy = decodeURIComponent(rawCode);
					} else {
						// Fallback to inner text
						textToCopy = code.innerText;
					}

					// Copy to clipboard
					await navigator.clipboard.writeText(textToCopy);

					// Visual feedback
					const originalText = copyButton.innerHTML;
					copyButton.innerHTML =
						'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
					copyButton.style.backgroundColor = 'var(--success-color, #4caf50)';

					// Reset after a delay
					setTimeout(() => {
						copyButton.innerHTML = originalText;
						copyButton.style.backgroundColor = '';
					}, 1500);
				} catch (error) {
					console.error('Failed to copy code:', error);
					copyButton.innerHTML =
						'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
					copyButton.style.backgroundColor = 'var(--error-color, #f44336)';

					setTimeout(() => {
						copyButton.innerHTML =
							'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
						copyButton.style.backgroundColor = '';
					}, 1500);
				}
			});
		});
	}

	// Run initialization when action is applied
	initCopyButtons();

	// Set up observer to handle dynamically added code blocks
	const observer = new MutationObserver((mutations) => {
		let shouldInit = false;

		for (const mutation of mutations) {
			if (mutation.type === 'childList' && mutation.addedNodes.length) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as HTMLElement;
						if (element.tagName === 'PRE' || element.querySelector('pre')) {
							shouldInit = true;
							break;
						}
					}
				}
			}

			if (shouldInit) break;
		}

		if (shouldInit) {
			initCopyButtons();
		}
	});

	// Start observing
	observer.observe(node, { childList: true, subtree: true });

	// Return action object with cleanup function
	return {
		destroy() {
			// Stop observing
			observer.disconnect();

			// Remove copy buttons
			const copyButtons = node.querySelectorAll('.copy-code-button');
			copyButtons.forEach((button) => {
				button.remove();
			});
		}
	};
}

// Export this as a alias for backward compatibility
export const addCopyCodeButtons = enhanceCodeBlocks;
