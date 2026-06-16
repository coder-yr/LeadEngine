import { supabase } from './src/config/supabase.js';

async function test() {
  const { data, error } = await supabase.from('campaign_steps').select('id').limit(1);
  console.log(JSON.stringify({ data, error }, null, 2));
}

test();
