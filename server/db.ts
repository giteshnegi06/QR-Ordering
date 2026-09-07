import dns from 'dns/promises';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const rawUrl = process.env.DATABASE_URL;

let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(): Promise<pg.Pool> {
  if (!rawUrl) {
    throw new Error('DATABASE_URL environment variable is missing. Please define it in your .env file or environment settings.');
  }
  const url = new URL(rawUrl);
  const hostname = url.hostname;

  // Resolve IPv4 directly to bypass Windows / Node IPv6 connection timeouts
  let connectHost = hostname;
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    connectHost = address;
  } catch (err) {
    console.warn('[DB] Failed IPv4 pre-resolve, fallback to hostname:', err);
  }

  const pool = new pg.Pool({
    host: connectHost,
    port: parseInt(url.port || '5432', 10),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false,
      servername: hostname, // Required by Neon SNI
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('[DB Pool Error]', err);
  });

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
