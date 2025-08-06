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
			checkOrigin: false // Disable CSRF protection for Docker testing
		},
		// Remove sensitive data from client bundle
		serviceWorker: {
			register: false // Disable service worker if not needed
		},
		// Add CSP to allow your server resources
		csp: {
			directives: {
				'default-src': [
					"'self'"
				],
				'script-src': [
					"'self'", 
					"'unsafe-inline'", 
					"'unsafe-eval'", 
					'http://100.77.36.61:3005', 
					'http://localhost:3005',
				],
				'worker-src': [
					"'self'",
					"blob:",
				],
				'style-src': [
					"'self'", 
					"'unsafe-inline'", 
					'https://fonts.googleapis.com'
				],
				'font-src': [
					"'self'", 
					'https://fonts.gstatic.com'
				],
				'img-src': [
					"'self'", 
					'data:', 
					'blob:', 
					'https:', 
					'http://100.77.36.61:8090'
				],
				'media-src': [
					"'self'", 
					'blob:', 
					'data:', 
					'http://100.77.36.61:8090', 
					'http://100.77.36.61:3002'
				],
				'connect-src': [
					"'self'", 
					'blob:',
					'http://localhost:8090',     // PocketBase (localhost)
					'http://100.77.36.61:8090',  // PocketBase (external access)
					'http://localhost:11434',    // Ollama
					'http://localhost:3002',     // Video Converter
					'http://localhost:5555',     // TTS
					'http://localhost:3006',     // Whisper
					'http://localhost:8000',     // CV Detection
					'http://localhost:3011',     // WebRTC Media
					'http://localhost:3025',     // WebRTC Signaling,
					'http://localhost:3004',  // Umami
					'ws://localhost:3004',     // Umami WebSocket
					'ws://localhost:8082',       // WebRTC WebSocket,
					'ws://100.77.36.61:8082',    // WebRTC WebSocket (external)
					'ws://localhost:8000',       // CV Detection WebSocket
					'ws://100.77.36.61:*',      // External WebSocket access
					'http://100.77.36.61:*',    // External HTTP access
					'ws://localhost:*', 
					'wss://localhost:*'
				]
			},
			mode: 'auto'
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