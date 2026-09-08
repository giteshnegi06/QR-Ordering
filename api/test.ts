/**
 * Simple test endpoint to verify Vercel serverless functions work.
 * No dependencies, no database, no imports.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    message: 'Vercel serverless function is working!',
    timestamp: new Date().toISOString(),
    env: {
      NODE_VERSION: process.version,
      VERCEL: process.env.VERCEL,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
    }
  });
}
