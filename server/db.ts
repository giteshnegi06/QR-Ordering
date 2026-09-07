import dns from 'dns/promises';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_URL = 'postgresql://neondb_owner:npg_9rBYzDSUdx8f@ep-gentle-dawn-axbdtdrz.c-4.us-east-2.aws.neon.tech/QR-Order?sslmode=require';
const rawUrl = process.env.DATABASE_URL || DEFAULT_URL;

let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(): Promise<pg.Pool> {
  const url = new URL(rawUrl);
  const hostname = url.hostname;

  // Resolve IPv4 directly to bypass any Windows / Node IPv6 timeouts
  let connectHost = hostname;
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    connectHost = address;
  } catch (err) {
    console.warn('[DB] Failed IPv4 pre-resolve, using hostname:', err);
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
    max: 20,
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
