import { pool } from './client';
import { migrateDatabase } from './migrate';
import { seedDatabase } from './seed';

async function hasUsersTable() {
  const result = await pool.query<{ exists: boolean }>("SELECT to_regclass('public.users') IS NOT NULL AS exists");
  return Boolean(result.rows[0]?.exists);
}

export async function ensureDatabaseReady() {
  const ready = await hasUsersTable().catch(() => false);
  if (ready) return { migrated: false, seeded: false };

  console.log('Database not initialized. Applying schema and seed data...');
  await migrateDatabase();
  await seedDatabase();
  return { migrated: true, seeded: true };
}
