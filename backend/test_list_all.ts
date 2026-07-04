import { supabase } from './src/config/supabase.js'; 
async function run() { 
  const { data } = await supabase.from('companies').select('name');
  console.log(data?.map(c => c.name).join(', '));
}; 
run();
