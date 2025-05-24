import { keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor, rectangularSelection, crosshairCursor, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { indentUnit } from '@codemirror/language';
import { getLanguageHighlighting } from '../themes/highlighting';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';

// Function to create autosave extension
export function createAutosaveExtension(saveCallback: (content: string) => void, debounceTime = 1000): Extension {
  let timer: ReturnType<typeof setTimeout>;
  
  return EditorState.transactionExtender.of((tr) => {
    if (tr.docChanged) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveCallback(tr.state.doc.toString());
      }, debounceTime);
    }
    return null;
  }) as Extension;
}

// Function to get language extension based on file type
export function getLanguageExtension(filename: string): Extension {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  
  switch (fileExtension) {
    case 'js':
      return javascript() as Extension;
    case 'jsx':
      return javascript({ jsx: true }) as Extension;
    case 'ts':
      return javascript({ typescript: true }) as Extension;
    case 'tsx':
      return javascript({ jsx: true, typescript: true }) as Extension;
    case 'html':
    case 'svelte':
      return html() as Extension;
    case 'css':
      return css() as Extension;
    case 'json':
      return json() as Extension;
    case 'md':
      return markdown() as Extension;
    case 'py':
      return python() as Extension;
    default:
      return javascript() as Extension;
  }
}

// Function to create basic extensions
export function createBasicExtensions(isDarkMode: boolean, languageExtension: Extension): Extension[] {
  const filename = 'example.ts';
  const themeHighlighting = getLanguageHighlighting(filename, isDarkMode) as Extension[];
  
  // Combine keymaps safely
  const allKeymaps = [
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...completionKeymap,
    ...closeBracketsKeymap,
    ...lintKeymap
  ];
  
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true) as Extension,
    indentUnit.of('  ') as Extension,
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of(allKeymaps) as Extension,
    rectangularSelection(),
    crosshairCursor(),
    closeBrackets(),
    autocompletion(),
    languageExtension,
    ...themeHighlighting
  ];
}