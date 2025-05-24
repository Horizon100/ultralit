import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Default dark theme highlighting
 */
export const darkHighlightStyle = HighlightStyle.define([
	{ tag: t.keyword, color: '#c678dd' },
	{ tag: t.comment, color: '#7f848e', fontStyle: 'italic' },
	{ tag: t.string, color: '#98c379' },
	{ tag: t.number, color: '#d19a66' },
	{ tag: t.literal, color: '#d19a66' },
	{ tag: t.regexp, color: '#e06c75' },
	{ tag: t.operator, color: '#56b6c2' },
	{ tag: t.variableName, color: '#e06c75' },
	{ tag: t.definitionKeyword, color: '#c678dd' },
	{ tag: t.className, color: '#e5c07b' },
	{ tag: t.propertyName, color: '#61afef' },
	{ tag: t.function(t.variableName), color: '#61afef' },
	{ tag: t.typeName, color: '#e5c07b' },
	{ tag: t.tagName, color: '#e06c75' },
	{ tag: t.attributeName, color: '#d19a66' },
	{ tag: t.heading, color: '#61afef', fontWeight: 'bold' },
	{ tag: t.link, color: '#98c379', textDecoration: 'underline' },
	{ tag: t.processingInstruction, color: '#56b6c2' },
	{ tag: t.definition(t.name), color: '#e06c75' }
]);

/**
 * Default light theme highlighting
 */
export const lightHighlightStyle = HighlightStyle.define([
	{ tag: t.keyword, color: '#8959a8' },
	{ tag: t.comment, color: '#8e908c', fontStyle: 'italic' },
	{ tag: t.string, color: '#718c00' },
	{ tag: t.number, color: '#f5871f' },
	{ tag: t.literal, color: '#f5871f' },
	{ tag: t.regexp, color: '#c82829' },
	{ tag: t.operator, color: '#3e999f' },
	{ tag: t.variableName, color: '#c82829' },
	{ tag: t.definitionKeyword, color: '#8959a8' },
	{ tag: t.className, color: '#eab700' },
	{ tag: t.propertyName, color: '#4271ae' },
	{ tag: t.function(t.variableName), color: '#4271ae' },
	{ tag: t.typeName, color: '#eab700' },
	{ tag: t.tagName, color: '#c82829' },
	{ tag: t.attributeName, color: '#f5871f' },
	{ tag: t.heading, color: '#4271ae', fontWeight: 'bold' },
	{ tag: t.link, color: '#718c00', textDecoration: 'underline' },
	{ tag: t.processingInstruction, color: '#3e999f' },
	{ tag: t.definition(t.name), color: '#c82829' }
]);

// Dark theme extension including syntax highlighting
export const darkThemeWithHighlighting = [
	EditorView.theme({
		'&': {
			color: '#ddd',
			backgroundColor: '#1e1e1e'
		},
		'.cm-content': {
			caretColor: '#528bff'
		},
		'.cm-cursor': {
			borderLeftColor: '#528bff'
		},
		'.cm-activeLine': {
			backgroundColor: '#2c313a'
		},
		'.cm-gutters': {
			backgroundColor: '#1e1e1e',
			color: '#7d8799',
			border: 'none'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#2c313a'
		},
		'.cm-selectionMatch': {
			backgroundColor: 'rgba(120, 145, 175, 0.2)'
		},
		'.cm-matchingBracket': {
			backgroundColor: 'rgba(255, 255, 255, 0.1)',
			color: '#abb2bf !important',
			outline: '1px solid #528bff'
		},
		'&.cm-focused .cm-matchingBracket': {
			backgroundColor: 'rgba(99, 123, 156, 0.25)'
		}
	}),
	syntaxHighlighting(darkHighlightStyle)
];

// Light theme extension including syntax highlighting
export const lightThemeWithHighlighting = [
	EditorView.theme({
		'&': {
			color: '#333',
			backgroundColor: '#fff'
		},
		'.cm-content': {
			caretColor: '#000'
		},
		'.cm-cursor': {
			borderLeftColor: '#000'
		},
		'.cm-activeLine': {
			backgroundColor: '#f0f0f0'
		},
		'.cm-gutters': {
			backgroundColor: '#f5f5f5',
			color: '#999',
			border: 'none'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#e9e9e9'
		},
		'.cm-selectionMatch': {
			backgroundColor: 'rgba(180, 215, 255, 0.5)'
		},
		'.cm-matchingBracket': {
			backgroundColor: 'rgba(0, 0, 0, 0.05)',
			color: '#333 !important',
			outline: '1px solid #4271ae'
		},
		'&.cm-focused .cm-matchingBracket': {
			backgroundColor: 'rgba(180, 215, 255, 0.3)'
		}
	}),
	syntaxHighlighting(lightHighlightStyle)
];

/**
 * Theme definitions for different programming languages or frameworks
 * You can add more specialized themes here
 */

// React/JSX specific highlighting
export const reactHighlightStyle = HighlightStyle.define([
	// Common syntax
	...darkHighlightStyle.specs,
	// JSX specific
	{ tag: t.tagName, color: '#61afef' },
	{ tag: t.attributeName, color: '#d19a66' },
	{ tag: t.angleBracket, color: '#abb2bf' }
]);

// TypeScript specific highlighting
export const typescriptHighlightStyle = HighlightStyle.define([
	// Common syntax
	...darkHighlightStyle.specs,
	// TypeScript specific
	{ tag: t.typeName, color: '#e5c07b' },
	{ tag: t.typeOperator, color: '#56b6c2' },
	{ tag: t.modifier, color: '#c678dd' }
]);

// Python specific highlighting
export const pythonHighlightStyle = HighlightStyle.define([
	// Common syntax
	...darkHighlightStyle.specs,
	// Python specific
	{ tag: t.self, color: '#e06c75' },
	{ tag: t.definition(t.variableName), color: '#61afef' },
	{ tag: t.className, color: '#e5c07b' }
]);

/**
 * Get syntax highlighting for a specific language
 */
export function getLanguageHighlighting(filename: string, isDarkMode: boolean) {
	const fileExtension = filename.split('.').pop()?.toLowerCase();

	// Base theme based on dark mode
	const baseTheme = isDarkMode ? darkThemeWithHighlighting : lightThemeWithHighlighting;

	// Specialized theme extensions based on file type
	if (fileExtension === 'tsx' || fileExtension === 'jsx') {
		return [baseTheme[0], syntaxHighlighting(reactHighlightStyle)];
	} else if (fileExtension === 'ts') {
		return [baseTheme[0], syntaxHighlighting(typescriptHighlightStyle)];
	} else if (fileExtension === 'py') {
		return [baseTheme[0], syntaxHighlighting(pythonHighlightStyle)];
	}

	// Default to base theme if no specialized theme
	return baseTheme;
}
