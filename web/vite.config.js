import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const backend = process.env.API_PROXY_TARGET || 'https://90plus.pro';
const proxied = { target: backend, changeOrigin: true };

export default defineConfig({
  root,
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        ass: fileURLToPath(new URL('./ass/index.html', import.meta.url)),
      },
    },
  },
  server: {
    // The page links to backend-served paths (legal pages, large logo); proxy them in dev.
    proxy: {
      '/api': proxied,
      '/90plus-logo-512.png': proxied,
      '/support': proxied,
      '/privacy': proxied,
      '/terms': proxied,
      '/delete-account': proxied,
    },
  },
});
