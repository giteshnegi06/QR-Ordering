/**
 * Database layer — uses @neondatabase/serverless Pool over HTTP/fetch.
 *
 * Why not pg?  The native `pg` package requires binary addons that Vercel's
 * bundler cannot include, causing FUNCTION_INVOCATION_FAILED at cold-start.
 * @neondatabase/serverless Pool talks to Neon over HTTPS with zero native
 * deps, so it works identically in Vercel serverless functions and Vite dev.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Only load .env in non-Vercel environments (Vercel injects env vars directly)
if (process.env.VERCEL !== '1') {
  dotenv.config();
}

// Route Pool queries through fetch (HTTP) instead of WebSocket.
// Required for Vercel serverless — WebSockets are not available there.
// Also eliminates the need for the ws package.
neonConfig.poolQueryViaFetch = true;

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_9rBYzDSUdx8f@ep-gentle-dawn-axbdtdrz-pooler.c-4.us-east-2.aws.neon.tech/QR-Order?sslmode=require';

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    if (!CONNECTION_STRING) {
      throw new Error('DATABASE_URL is not set. Please configure it in Vercel Environment Variables or .env file.');
    }
    
    console.log('[DB] Initializing connection pool...');
    console.log('[DB] Connection string preview:', CONNECTION_STRING.substring(0, 35) + '...');
    
    _pool = new Pool({ connectionString: CONNECTION_STRING });
    
    // Test the connection immediately
    _pool.query('SELECT 1 as test')
      .then(() => console.log('[DB] ✅ Connection test successful'))
      .catch((err) => {
        console.error('[DB] ❌ Connection test failed:', err.message);
        _pool = null; // Reset pool so next request can retry
      });
  }
  return _pool;
}

/**
 * Drop-in replacement for the old `pg` query helper.
 * Returns `{ rows: T[] }` so all existing call-sites stay unchanged.
 */
export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<{ rows: T[] }> {
  try {
    const pool = getPool();
    const result = await pool.query<T>(text, params);
    return { rows: result.rows };
  } catch (err: any) {
    console.error('[DB Query Error]', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      query: text.substring(0, 100),
    });
    throw err;
  }
}
