const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.pfuaprjtjikcleyvaheq:6qCf3HH$k$zxU%40%23@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await pool.query('ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_email_or_phone');
    console.log('Constraint dropped successfully!');
    
    // Add a new constraint that allows linkedin or just a name for future enrichment
    await pool.query(`
      ALTER TABLE contacts 
      ADD CONSTRAINT contacts_minimum_info 
      CHECK (
        email IS NOT NULL OR 
        phone IS NOT NULL OR 
        linkedin_url IS NOT NULL OR 
        (first_name IS NOT NULL AND first_name != '')
      )
    `);
    console.log('New constraint added successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
