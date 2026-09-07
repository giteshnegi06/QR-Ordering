import express from 'express';
import { apiRouter } from '../server/api';

const app = express();

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow all origins so the deployed frontend and any external clients
// (Swagger Try-It-Out, Postman, etc.) can reach the API.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Vercel invokes this file as /api/index, and the rewrite rule in vercel.json
// sends "/api/(.*)" here — so Express sees the full path "/api/cafe",
// "/api/orders", etc.  Mount the router under /api to match.
//
// We also mount it at "/" as a fallback for any edge case where Vercel strips
// the prefix, but we do NOT double-register swagger-ui-express (it conflicts
// when the same static middleware is registered on two paths).
app.use('/api', apiRouter);

// Global error handler — prevents Vercel FUNCTION_INVOCATION_FAILED crashes
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

export default app;
