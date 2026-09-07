import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Fallback connection string for local dev when .env is missing.
// On Vercel, DATABASE_URL must be set in the project's Environment Variables.
const DEFAULT_URL = 'postgresql://neondb_owner:npg_9rBYzDSUdx8f@ep-gentle-dawn-axbdtdrz-pooler.c-4.us-east-2.aws.neon.tech/QR-Order?sslmode=require';

let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(): Promise<pg.Pool> {
  // Strip channel_binding param — it's not supported by Neon's connection pooler
  const rawUrl = (process.env.DATABASE_URL || DEFAULT_URL).replace(/[&?]channel_binding=[^&]*/g, '');
  const url = new URL(rawUrl);
  const hostname = url.hostname;

  // On Vercel (Linux), DNS resolves fine. On Windows dev machines, Node sometimes
  // prefers IPv6 and times out — pre-resolve to IPv4 as a workaround.
  let connectHost = hostname;
  if (process.platform === 'win32') {
    try {
      const dns = await import('dns/promises');
      const { address } = await dns.lookup(hostname, { family: 4 });
      connectHost = address;
      console.log('[DB] Resolved', hostname, '→', connectHost);
    } catch (err) {
      console.warn('[DB] IPv4 pre-resolve failed, using hostname directly:', err);
    }
  }

  const pool = new pg.Pool({
    host: connectHost,
    port: parseInt(url.port || '5432', 10),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0], // strip any leftover query params
    ssl: {
      rejectUnauthorized: false,
      servername: hostname, // Required for Neon SNI even when connecting by IP
    },
    max: 5,                        // keep low for serverless — each invocation gets its own pool
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[DB Pool Error]', err);
    poolPromise = null; // reset so next request gets a fresh pool
  });

  // Verify the connection works at startup
  try {
    const client = await pool.connect();
    client.release();
    console.log('[DB] Connected to Neon PostgreSQL ✓');
  } catch (err) {
    console.error('[DB] Initial connection test failed:', err);
    poolPromise = null;
    throw err;
  }

  return pool;
}

export async function getPool(): Promise<pg.Pool> {
  if (!poolPromise) {
    poolPromise = createPool();
  }
  return poolPromise;
}

export async function query(text: string, params: any[] = []) {
  const pool = await getPool();
  return pool.query(text, params);
}
