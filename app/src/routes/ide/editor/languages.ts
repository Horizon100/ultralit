/* eslint-disable @typescript-eslint/no-explicit-any */

import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';

/**
 * Get the appropriate language support extension based on file extension
 */
export function getLanguageSupport(filename: string): any {
	const extension = filename.split('.').pop()?.toLowerCase() || '';

	switch (extension) {
		case 'js':
			return javascript() as any;
		case 'ts':
		case 'tsx':
			return javascript({ typescript: true }) as any;
		case 'jsx':
			return javascript({ jsx: true }) as any;
		case 'css':
			return css() as any;
		case 'html':
		case 'svelte':
			return html() as any;
		case 'md':
		case 'markdown':
			return markdown() as any;
		default:
			return javascript({ typescript: true }) as any;
	}
}
