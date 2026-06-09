import { Pool, type PoolClient as PgPoolClient } from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRESQL_URL ??
  process.env.DATABASE_URI ??
  process.env.PGURI;

if (!databaseUrl) {
  throw new Error('A PostgreSQL connection string is required. Set DATABASE_URL or POSTGRES_URL.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export type PoolClient = PgPoolClient;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
