import { supabase } from './src/config/supabase.js';

async function test() {
  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      company_intelligence (
        lead_score,
        digital_maturity_score,
        services_needed,
        website_score,
        crm_detected,
        whatsapp_detected,
        booking_detected,
        social_profiles
      ),
      company_signals (
        intent_score,
        signals
      ),
      websites (*),
      contacts (*),
      activities (*)
    `)
    .limit(1)
    .single();

  console.log(JSON.stringify({ data, error }, null, 2));
}

test();
