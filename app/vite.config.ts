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
    // proxy: {
    //   '/api': {
    //     target: 'http://172.104.188.44/',
    //     changeOrigin: true,
    //     // rewrite: (path) => path.replace(/^\/api/, ''),
    //     // configure: (proxy) => {
    //     //   proxy.on('proxyReq', (proxyReq, req, res) => {
    //     //     // Debugging: Log headers
    //     //     console.log('Proxy Request Headers:', proxyReq.getHeaders());
            
    //     //     proxyReq.setHeader('Origin', 'http://localhost:8090');
    //     //     proxyReq.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    //     //   });
    //     // }
    //   }
    // },
    cors: {
      origin: [
        'http://localhost:8090',
        'http://172.104.188.44',
        'https://172.104.188.44'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept', 
        'Origin'
      ],
      credentials: true
    }
  }
});