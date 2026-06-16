import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { runSqlFile } from './run-sql-file.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, 'migrations');

try {
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migrationFile = resolve(migrationsDir, file);
    console.log(`Running migration: ${file}`);
    await runSqlFile(migrationFile);
  }
  console.log('All migrations ran successfully.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Failed to run migrations.');
  process.exit(1);
}