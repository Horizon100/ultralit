import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [sveltekit()],
    assetsInclude: ['**/*.svg'],
    css: {
      preprocessorOptions: {
        scss: {}
      }
    },
    server: {
      port: 5173,
      cors: {
        origin: [
          'http://localhost:5173',
          env.VITE_POCKETBASE_URL || 'http://localhost:8090',
          env.OLLAMA_DEV_URL || 'http://localhost:11434',
          // Add any other origins from env
          env.VITE_ADDITIONAL_ORIGIN
        ].filter(Boolean),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        credentials: true
      }
    },
    build: {
      minify: true
    }
  };
});