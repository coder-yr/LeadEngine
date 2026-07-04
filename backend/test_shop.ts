import { supabase } from './src/config/supabase.js'; 
async function run() { 
  const { data } = await supabase.from('companies').select('id, name').ilike('name', '%shop%');
  console.log('Matches:', data); 
}; 
run();
