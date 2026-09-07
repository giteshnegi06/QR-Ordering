import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    async configureServer(server) {
      // Build the Express app ONCE when the dev server starts —
      // not on every request. Creating a new Express app per-request
      // means the body has already been consumed before json() can parse it.
      const express = (await import('express')).default;
      const { apiRouter } = await import('./server/api');

      const app = express();

      // Body parsing — must be registered before the router
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true }));

      // CORS for local dev
      app.use((_req, _res, _next) => {
        _res.setHeader('Access-Control-Allow-Origin', '*');
        _res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        _res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (_req.method === 'OPTIONS') return _res.status(200).end();
        _next();
      });

      app.use('/api', apiRouter);

      // Mount the fully-configured Express app into Vite's middleware chain
      server.middlewares.use(app);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
