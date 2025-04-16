import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		sveltePreprocess({
			scss: {
				prependData: `@use "src/styles/themes.scss" as *;`
			}
		})
	],
	kit: {
		adapter: adapter({
			fallback: 'index.html',
			strict: false
		}),
	}
};

export default config;
