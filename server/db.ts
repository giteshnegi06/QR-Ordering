import dns from 'dns/promises';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_URL = 'postgresql://neondb_owner:npg_9rBYzDSUdx8f@ep-gentle-dawn-axbdtdrz.c-4.us-east-2.aws.neon.tech/QR-Order?sslmode=require';
const rawUrl = process.env.DATABASE_URL || DEFAULT_URL;

let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(): Promise<pg.Pool> {
  const pool = new pg.Pool({
    connectionString: rawUrl,
    ssl: {
      rejectUnauthorized: false,
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
