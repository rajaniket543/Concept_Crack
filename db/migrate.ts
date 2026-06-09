import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from './client';

export async function migrateDatabase() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(here, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Database schema applied.');
}

async function main() {
  await migrateDatabase();
  await pool.end();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async (error) => {
    console.error(error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
}
