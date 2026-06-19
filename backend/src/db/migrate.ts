import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runSqlFile } from './run-sql-file.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(currentDir, 'migrations/001_create_base_schema.sql');

try {
  await runSqlFile(migrationFile);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Failed to run migrations.');
  process.exit(1);
}