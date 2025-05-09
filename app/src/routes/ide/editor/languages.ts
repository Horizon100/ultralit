import { LanguageSupport } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';

/**
 * Get the appropriate language support extension based on file extension
 */
export function getLanguageSupport(filename: string): LanguageSupport {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'js':
      return javascript();
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true });
    case 'jsx':
      return javascript({ jsx: true });
    case 'css':
      return css();
    case 'html':
    case 'svelte':
      return html();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      // Default to TypeScript for unknown extensions
      return javascript({ typescript: true });
  }
}