import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['buffer'],
  },
  server: {
    proxy: {
      '/crates-api': {
        target: 'https://crates.io/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/crates-api/, ''),
      },
    },
  },
});
