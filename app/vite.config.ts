import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
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
      host: mode === 'development' ? 'localhost' : '0.0.0.0',
      cors: {
        origin: mode === 'development' ? [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          env.VITE_POCKETBASE_URL || 'http://localhost:8090'
        ] : false, // Disable CORS in production
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
        credentials: true
      },
      headers: mode === 'development' ? {
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin'
      } : {}
    },
    build: {
      minify: true,
      sourcemap: false, 
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['svelte', '@sveltejs/kit'],
            pocketbase: ['pocketbase']
          }
        }
      }
    },
    define: {
      // Remove console.log in production
      'console.log': mode === 'production' ? '() => {}' : 'console.log',
      'console.warn': mode === 'production' ? '() => {}' : 'console.warn'
    }
  };
});