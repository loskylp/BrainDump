/**
 * Vite configuration for BrainDump frontend.
 *
 * Key configuration:
 *   - React plugin for JSX transform
 *   - API proxy: all /api/* requests in development are forwarded to the
 *     Express backend at http://localhost:3000. This eliminates CORS issues
 *     in local development and matches the production layout where the same
 *     server serves both the SPA and the API.
 *
 * The proxy configuration mirrors the production path where Express serves
 * the built frontend from its /public directory and all /api/* requests are
 * handled directly by Express.
 *
 * Build output:
 *   dist/  -- static assets consumed by the Docker multi-stage build (Dockerfile)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
