import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/']
	},
	{
		rules: {
			'no-warning-comments': [
				'error',
				{ terms: ['todo', 'fixme', '@ts-ignore'], location: 'anywhere' }
			],
			'multiline-comment-style': ['error', 'starred-block'],
			'line-comment-position': ['error', { position: 'beside' }],
			'no-inline-comments': 'error',
			'spaced-comment': ['error', 'always'],
			'no-multi-spaces': 'error'
		}
	}
];
