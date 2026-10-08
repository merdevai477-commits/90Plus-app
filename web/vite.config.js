import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const apiTarget = process.env.API_PROXY_TARGET || 'https://90plus.pro';

export default defineConfig({
  root,
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    rollupOptions: {
      input: {
        index: `${root}index.html`,
        news: `${root}news.html`,
      },
    },
  },
  server: {
    // Pages link to backend-served paths (legal pages, logo, API); proxy them in dev.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/90plus-logo-512.png': { target: apiTarget, changeOrigin: true },
    },
  },
});
