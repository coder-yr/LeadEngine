import { resolve } from 'path';
import { runSqlFile } from './src/db/run-sql-file.js';
import { supabase } from './src/config/supabase.js';

async function run() {
  try {
    await runSqlFile(resolve('./src/db/migrations/009_create_outreach_sequences.sql'));
    await runSqlFile(resolve('./src/db/migrations/010_create_proposals.sql'));
    await supabase.rpc('reload_schema_cache');
    console.log("Success");
  } catch (err) {
    console.error(err);
  }
}
run();
