/**
 * Standalone Express server for running outside of Vite dev mode.
 *
 * Usage:
 *   npm run server            — API only on port 3001 (pair with `npm run dev` or `npm run preview`)
 *   PORT=3001 npm run server  — custom port
 *
 * In production you normally don't need this — Vercel runs api/index.ts as a
 * serverless function.  This file is useful for:
 *   • Local testing without Vite (e.g. after `npm run build && npm run preview`)
 *   • Docker / VPS deployments where you need a long-running process
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// API routes
app.use('/api', apiRouter);

// Serve the Vite-built frontend from dist/ when it exists
const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));

// SPA fallback — any unknown path returns index.html so React Router works
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]:', err);
  res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Docs:   http://localhost:${PORT}/api/docs`);
  console.log(`   UI:     http://localhost:${PORT}/\n`);
});
