import adapter from '@sveltejs/adapter-node';
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
			out: 'build',
			precompress: true,
		}),
	}
};

export default config;
