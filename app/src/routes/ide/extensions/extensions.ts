import { keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor, rectangularSelection, crosshairCursor, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { indentUnit, syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language';
import { getLanguageHighlighting } from '../themes/highlighting';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';

// Function to create autosave extension
export function createAutosaveExtension(saveCallback: (content: string) => void, debounceTime = 1000) {
  let timer: ReturnType<typeof setTimeout>;
  
  return EditorState.transactionExtender.of((tr) => {
    if (tr.docChanged) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveCallback(tr.state.doc.toString());
      }, debounceTime);
    }
    return null;
  });
}

// Function to get language extension based on file type
export function getLanguageExtension(filename: string): Extension {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  
  switch (fileExtension) {
    case 'js':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'html':
    case 'svelte': // Simplified support for Svelte files
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'md':
      return markdown();
    case 'py':
      return python();
    default:
      // Fallback to JavaScript for unknown file types
      return javascript();
  }
}

// Function to create basic extensions
export function createBasicExtensions(isDarkMode: boolean, languageExtension: Extension): Extension[] {
  /*
   * Get file name from languageExtension if available
   * This is a simplification; in practice, you'd need to find a way to get the filename
   */
  const filename = 'example.ts'; // Default
  
  // Get the theme highlighting based on filename and dark mode
  const themeHighlighting = getLanguageHighlighting(filename, isDarkMode);
  
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentUnit.of('  '), // 2 spaces indentation
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...closeBracketsKeymap,
      ...lintKeymap
    ]),
    rectangularSelection(),
    crosshairCursor(),
    closeBrackets(),
    autocompletion(),
    languageExtension,
    ...themeHighlighting
  ];
}