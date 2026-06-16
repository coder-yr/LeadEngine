import { supabase } from './src/config/supabase.js';

async function test() {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      campaign_steps (*),
      campaign_enrollments (count)
    `)
    .limit(1);

  console.log(JSON.stringify({ data, error }, null, 2));
}

test();
