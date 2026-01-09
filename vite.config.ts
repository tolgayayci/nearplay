import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
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
