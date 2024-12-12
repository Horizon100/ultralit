import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "src/themes.scss" as *;'
      }
    }
  },
  server: {
    port: 8090,
  }
});