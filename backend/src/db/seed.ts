import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runSqlFile } from './run-sql-file.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const seedFile = resolve(currentDir, 'seed.sql');

try {
  await runSqlFile(seedFile);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Failed to seed the database.');
  process.exit(1);
}