import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runSqlFile } from './run-sql-file.js';
import * as fs from 'node:fs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, 'migrations');

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  const migrationFile = resolve(migrationsDir, file);
  console.log(`Running migration: ${file}`);
  try {
    await runSqlFile(migrationFile);
    console.log(`Success: ${file}`);
  } catch (error) {
    console.warn(`Skipped/Error in ${file}:`, error instanceof Error ? error.message : 'Unknown error');
    // Continue to the next file (e.g. if tables/types already exist)
  }
}