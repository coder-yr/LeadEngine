import { supabase } from './src/config/supabase.js';

async function test() {
  const { data, error } = await supabase
    .from('discovery_results')
    .select('*, companies(*)')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error(error);
}

test();
