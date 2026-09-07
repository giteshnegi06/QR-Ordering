import express from 'express';
import { apiRouter } from '../server/api';

const app = express();

app.use(express.json());

// Enable CORS for Vercel deployment
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Handle both /api prefix and root path in Vercel serverless environment
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler to prevent Vercel FUNCTION_INVOCATION_FAILED crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Vercel Serverless Error]:', err);
  res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

export default app;
