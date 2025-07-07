import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    vitePreprocess(),
    sveltePreprocess({
      scss: {}
    })
  ],
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
      polyfill: false // Reduce bundle size
    }),
    csrf: {
      checkOrigin: true, // Enable CSRF protection
    },
    // Remove sensitive data from client bundle
    serviceWorker: {
      register: false // Disable service worker if not needed
    }
  },
  onwarn: (warning, handler) => {
    // Hide CSS warnings in production
    if (warning.code === 'css-unused-selector') return;
    if (warning.code === 'a11y-click-events-have-key-events') return;
    handler(warning);
  }
};

export default config;