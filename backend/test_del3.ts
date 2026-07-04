import { supabase } from './src/config/supabase.js'; 
async function run() { 
  const { data } = await supabase.from('companies').select('id, name, discovery_job_id'); 
  const count = data?.filter(c => c.discovery_job_id !== null).length; 
  console.log('Companies with discovery_job_id:', count); 
  const { data: searchResult } = await supabase.from('companies').select('id, name').ilike('name', '%shopwijgn%');
  console.log('Shopwijgn:', searchResult);
}; 
run();
