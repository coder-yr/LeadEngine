import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

for (const envPath of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

export async function runSqlFile(filePath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run SQL files.');
  }

  if (!existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }

  const sql = readFileSync(filePath, 'utf8');
  try {
    new URL(databaseUrl);
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid URL. If your password contains special characters such as @ or #, percent-encode it first.',
    );
  }

  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}