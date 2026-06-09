import { pool } from './client';
import { migrateDatabase } from './migrate';
import { seedDatabase } from './seed';
import { pathToFileURL } from 'node:url';

export async function resetDatabase() {
  await migrateDatabase();
  await seedDatabase();
}

async function main() {
  await resetDatabase();
  await pool.end();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async (error) => {
    console.error(error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
}
