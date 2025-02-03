import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	css: {
		preprocessorOptions: {
			scss: {
				additionalData: '@use "src/styles/themes.scss" as *;'
			}
		}
	},
	server: {
		port: 5173,
		cors: {
			origin: [
				'http://localhost:5173', 
				'http://172.104.188.44', 
				'https://172.104.188.44'
				],
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
			credentials: true
		}
	}
});
