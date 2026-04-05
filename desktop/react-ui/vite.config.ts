import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    // Expose environment variables to frontend
    __VITE_API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001'),
    __VITE_AI_ENGINE_URL__: JSON.stringify(process.env.VITE_AI_ENGINE_URL || 'http://127.0.0.1:8000'),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy /api calls to backend
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying for socket.io
      },
      // Proxy /ai calls to AI engine
      '/ai': {
        target: process.env.VITE_AI_ENGINE_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (
            id.includes('node_modules/socket.io-client') ||
            id.includes('node_modules/engine.io-client') ||
            id.includes('node_modules/socket.io-parser') ||
            id.includes('node_modules/uuid')
          ) {
            return 'chat-vendor';
          }
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-')) {
            return 'markdown';
          }
          if (
            id.includes('node_modules/react-syntax-highlighter') ||
            id.includes('node_modules/refractor') ||
            id.includes('node_modules/prismjs')
          ) {
            return 'syntax';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
          if (id.includes('node_modules/recharts')) {
            return 'charts';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  base: './',
});
