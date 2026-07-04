import { supabase } from './src/config/supabase.js'; 
async function run() { 
  const { data } = await supabase.from('companies').select('id, name, discovery_job_id, website_url'); 
  console.log(JSON.stringify(data, null, 2)); 
}; 
run();
