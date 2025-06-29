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
			// DISABLE rules that are noisy during development
			'@typescript-eslint/no-unused-vars': 'off', // Very common during development
			'svelte/valid-compile': 'off', // Disable unused export warnings for Svelte props

			// SECURITY - Keep these as warnings (don't disable)
			'svelte/no-at-html-tags': 'warn', // XSS protection - review each case

			// TYPE SAFETY - Keep as warnings
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/ban-ts-comment': 'warn',

			// GENERAL - Relaxed
			'no-case-declarations': 'warn',
			'no-undef': 'warn',
			'no-unreachable': 'warn',
			'no-constant-condition': 'warn',
			'no-empty': 'warn',
			'no-prototype-builtins': 'warn',
			'no-useless-escape': 'warn',

			// COMMENTS - Disable during development, enable for production
			'no-warning-comments': 'off', // Allow TODO/FIXME during development
			'multiline-comment-style': 'off', // Don't enforce comment style
			'spaced-comment': 'off', // Don't enforce comment spacing
			'no-multi-spaces': 'warn'
		}
	}
];
