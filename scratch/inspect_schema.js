const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tables = ['companies', 'contacts', 'websites', 'campaigns', 'messages', 'activities', 'discovery_jobs', 'discovery_results', 'lists', 'tasks', 'proposals'];
  
  console.log("=== TABLES & COLUMNS ===");
  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    console.log(`\nTable: ${table}`);
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
  }

  console.log("\n=== RLS POLICIES ===");
  const policies = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies
  `);
  policies.rows.forEach(p => {
    console.log(`Table: ${p.tablename} | Policy: ${p.policyname} | Cmd: ${p.cmd} | Qual: ${p.qual}`);
  });

  await client.end();
}
run().catch(console.error);
