import { supabase } from './src/config/supabase.js'; 
async function run() { 
  const { data } = await supabase.from('discovery_results').select('company_id, raw_data');
  console.log(JSON.stringify(data?.slice(0,5), null, 2)); 
}; 
run();
