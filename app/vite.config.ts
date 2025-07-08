import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import os from 'os';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Auto-detect if we're running on a server (has no display/GUI)
  const isServerEnvironment = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && os.platform() === 'linux';
  
  // Get development URLs from environment or use defaults
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    env.VITE_POCKETBASE_URL || 'http://localhost:8090'
  ];
  
  // Add code-server URL if specified in environment
  if (env.VITE_CODE_SERVER_URL) {
    devOrigins.push(env.VITE_CODE_SERVER_URL);
  }
  
  // Auto-detect host binding
  const defaultHost = isServerEnvironment ? '0.0.0.0' : 'localhost';
  const host = env.VITE_DEV_HOST || defaultHost;
  
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
      host: host,
      timeout: 300000,
      cors: {
        origin: mode === 'development' ? devOrigins : false,
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