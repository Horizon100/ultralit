/* eslint-disable @typescript-eslint/no-explicit-any */
// src/routes/ide/extensions/extensions.ts

import {
	keymap,
	highlightSpecialChars,
	drawSelection,
	highlightActiveLine,
	dropCursor,
	rectangularSelection,
	crosshairCursor,
	lineNumbers,
	highlightActiveLineGutter
} from '@codemirror/view';
import { EditorState, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
	autocompletion,
	completionKeymap,
	closeBrackets,
	closeBracketsKeymap
} from '@codemirror/autocomplete';
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
export function createAutosaveExtension(
	saveCallback: (content: string) => void,
	debounceTime = 1000
): any {
	let timer: ReturnType<typeof setTimeout>;

	return StateField.define({
		create() {
			return null;
		},
		update(value: any, tr: any) {
			if (tr.docChanged) {
				clearTimeout(timer);
				timer = setTimeout(() => {
					saveCallback(tr.state.doc.toString());
				}, debounceTime);
			}
			return value;
		}
	}) as any;
}

// Function to get language extension based on file type
export function getLanguageExtension(filename: string): any {
	const fileExtension = filename.split('.').pop()?.toLowerCase();

	switch (fileExtension) {
		case 'js':
			return javascript() as any;
		case 'jsx':
			return javascript({ jsx: true }) as any;
		case 'ts':
			return javascript({ typescript: true }) as any;
		case 'tsx':
			return javascript({ jsx: true, typescript: true }) as any;
		case 'html':
		case 'svelte':
			return html() as any;
		case 'css':
			return css() as any;
		case 'json':
			return json() as any;
		case 'md':
			return markdown() as any;
		case 'py':
			return python() as any;
		default:
			return javascript() as any;
	}
}

// Function to create basic extensions
export function createBasicExtensions(isDarkMode: boolean, languageExtension: any): any[] {
	const filename = 'example.ts';
	const themeHighlighting = getLanguageHighlighting(filename, isDarkMode);

	const baseExtensions: any[] = [
		lineNumbers() as any,
		highlightActiveLineGutter() as any,
		highlightSpecialChars() as any,
		history() as any,
		drawSelection() as any,
		dropCursor() as any,
		EditorState.allowMultipleSelections.of(true) as any,
		indentUnit.of('  ') as any,
		highlightActiveLine() as any,
		highlightSelectionMatches() as any,
		rectangularSelection() as any,
		crosshairCursor() as any,
		closeBrackets() as any,
		autocompletion() as any,
		languageExtension as any
	];

	// Add basic keymap only to avoid conflicts
	try {
		baseExtensions.push(keymap.of(defaultKeymap as any) as any);
	} catch (error) {
		console.warn('Keymap failed, continuing without keymaps:', error);
	}

	// Handle theme highlighting safely
	if (themeHighlighting) {
		if (Array.isArray(themeHighlighting)) {
			baseExtensions.push(...(themeHighlighting.filter(Boolean) as any[]));
		} else if (themeHighlighting) {
			baseExtensions.push(themeHighlighting as any);
		}
	}

	return baseExtensions;
}
