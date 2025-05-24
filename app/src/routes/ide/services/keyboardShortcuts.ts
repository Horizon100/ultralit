// src/lib/services/keyboardShortcuts.ts
import type { EditorView } from '@codemirror/view';

/**
 * Sets up keyboard shortcuts for the code editor
 * @param editorView The CodeMirror editor view
 * @param callbacks Object containing callback functions for different shortcuts
 */
export function setupKeyboardShortcuts(
	editorView: EditorView,
	callbacks: {
		onSave?: () => void;
		onFormat?: () => void;
		// Add more shortcuts as needed
	}
) {
	const handleKeyDown = (event: KeyboardEvent) => {
		// Check if Ctrl+S or Cmd+S (Mac) was pressed
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault(); // Prevent browser's save dialog

			if (callbacks.onSave) {
				callbacks.onSave();
			}
		}

		/*
		 * Add more shortcuts as needed
		 * For example: Ctrl+Shift+F for formatting
		 */
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'f') {
			event.preventDefault();

			if (callbacks.onFormat) {
				callbacks.onFormat();
			}
		}
	};

	// Add the event listener to the window, as CodeMirror doesn't always capture it
	window.addEventListener('keydown', handleKeyDown);

	// Return a cleanup function to remove the event listener
	return () => {
		window.removeEventListener('keydown', handleKeyDown);
	};
}
