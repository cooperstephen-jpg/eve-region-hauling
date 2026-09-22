// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The GitHub Pages repo name this site is served from, e.g. https://<you>.github.io/<REPO_NAME>/
// Update this if you rename the repository.
const REPO_NAME = process.env.VITE_REPO_NAME || 'eve-region-hauling';

export default defineConfig(({ command }) => {
  return {
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    },
    // Local dev server serves from '/'; production build is served from the GH Pages repo subpath.
    base: command === 'serve' ? '/' : `/${REPO_NAME}/`,
    plugins: [react()],
  };
});
